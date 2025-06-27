import { sql } from "./neon-client-fixed"
import { neonBlobStorage } from "./neon-blob-storage"
import sharp from "sharp"
import { createHash } from "crypto"

interface ImageOptimizationConfig {
  quality: {
    webp: number
    avif: number
    thumbnail: number
  }
  sizes: {
    maxWidth: number
    thumbnailWidth: number
  }
  storage: {
    provider: "neon-blob" | "external"
    cdnUrl?: string
  }
}

export class NeonImageOptimizationBlobService {
  private config: ImageOptimizationConfig = {
    quality: {
      webp: Number.parseInt(process.env.WEBP_QUALITY || "75"),
      avif: Number.parseInt(process.env.AVIF_QUALITY || "65"),
      thumbnail: Number.parseInt(process.env.THUMBNAIL_QUALITY || "60"),
    },
    sizes: {
      maxWidth: Number.parseInt(process.env.MAX_IMAGE_WIDTH || "1200"),
      thumbnailWidth: Number.parseInt(process.env.THUMBNAIL_WIDTH || "300"),
    },
    storage: {
      provider: "neon-blob",
      cdnUrl: process.env.IMAGE_CDN_URL,
    },
  }

  /**
   * Process a single image with blob storage (for migration)
   */
  async processImage(
    propertyId: number,
    imageData: {
      original_url: string
      description: string
      display_order: number
      buffer: Buffer
    },
    displayOrder: number,
  ): Promise<{
    success: boolean
    urls?: {
      webp: string
      avif: string
      thumbnail: string
    }
    sizes?: {
      webp: number
      avif: number
      thumbnail: number
    }
    deduplicated?: boolean
    spaceSaved?: number
    error?: string
  }> {
    const startTime = Date.now()

    try {
      const { buffer, original_url, description } = imageData
      const originalSize = buffer.length

      // Get image metadata
      const metadata = await sharp(buffer).metadata()
      const { width, height, format } = metadata

      // Skip if image is too small
      if (width && width < 200) {
        throw new Error("Image too small for processing")
      }

      // Check for existing processed images (deduplication)
      const imageHash = createHash("sha256").update(buffer).digest("hex")
      const existingImage = await this.findExistingProcessedImage(imageHash)

      if (existingImage) {
        // Reuse existing processed image
        await this.saveImageRecord(propertyId, {
          originalUrl: original_url,
          originalDescription: description,
          displayOrder,
          webpBlobId: existingImage.webp_blob_id,
          avifBlobId: existingImage.avif_blob_id,
          thumbnailBlobId: existingImage.thumbnail_blob_id,
          webpUrl: existingImage.webp_url,
          avifUrl: existingImage.avif_url,
          thumbnailUrl: existingImage.thumbnail_url,
          originalWidth: width,
          originalHeight: height,
          fileSizeOriginal: originalSize,
          fileSizeWebp: existingImage.file_size_webp,
          fileSizeAvif: existingImage.file_size_avif,
          processingStatus: "completed",
          imageHash,
        })

        return {
          success: true,
          urls: {
            webp: existingImage.webp_url,
            avif: existingImage.avif_url,
            thumbnail: existingImage.thumbnail_url,
          },
          sizes: {
            webp: existingImage.file_size_webp,
            avif: existingImage.file_size_avif,
            thumbnail: existingImage.file_size_thumbnail || 0,
          },
          deduplicated: true,
          spaceSaved: originalSize,
        }
      }

      // Determine optimal dimensions
      const targetWidth = width && width > this.config.sizes.maxWidth ? this.config.sizes.maxWidth : width

      // Create Sharp instance
      let sharpInstance = sharp(buffer)

      // Resize if needed
      if (targetWidth && targetWidth < (width || 0)) {
        sharpInstance = sharpInstance.resize(targetWidth, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
      }

      // Generate optimized formats in parallel
      const [webpBuffer, avifBuffer, thumbnailBuffer] = await Promise.all([
        // WebP format
        sharpInstance
          .clone()
          .webp({
            quality: this.config.quality.webp,
            effort: 6,
          })
          .toBuffer(),

        // AVIF format (best compression)
        sharpInstance
          .clone()
          .avif({
            quality: this.config.quality.avif,
            effort: 9,
          })
          .toBuffer(),

        // Thumbnail
        sharp(buffer)
          .resize(this.config.sizes.thumbnailWidth, null, {
            withoutEnlargement: true,
            fit: "inside",
          })
          .webp({ quality: this.config.quality.thumbnail })
          .toBuffer(),
      ])

      // Store optimized images in blob storage
      const [webpBlob, avifBlob, thumbnailBlob] = await Promise.all([
        neonBlobStorage.storeFile(webpBuffer, `${propertyId}-${displayOrder}.webp`, "image/webp", {
          propertyId,
          displayOrder,
          type: "webp",
          originalHash: imageHash,
        }),
        neonBlobStorage.storeFile(avifBuffer, `${propertyId}-${displayOrder}.avif`, "image/avif", {
          propertyId,
          displayOrder,
          type: "avif",
          originalHash: imageHash,
        }),
        neonBlobStorage.storeFile(thumbnailBuffer, `${propertyId}-${displayOrder}-thumb.webp`, "image/webp", {
          propertyId,
          displayOrder,
          type: "thumbnail",
          originalHash: imageHash,
        }),
      ])

      // Save image record with blob references
      await this.saveImageRecord(propertyId, {
        originalUrl: original_url,
        originalDescription: description,
        displayOrder,
        webpBlobId: webpBlob.id,
        avifBlobId: avifBlob.id,
        thumbnailBlobId: thumbnailBlob.id,
        webpUrl: webpBlob.url,
        avifUrl: avifBlob.url,
        thumbnailUrl: thumbnailBlob.url,
        originalWidth: width,
        originalHeight: height,
        fileSizeOriginal: originalSize,
        fileSizeWebp: webpBuffer.length,
        fileSizeAvif: avifBuffer.length,
        fileSizeThumbnail: thumbnailBuffer.length,
        processingStatus: "completed",
        imageHash,
      })

      const processingTime = Date.now() - startTime

      return {
        success: true,
        urls: {
          webp: webpBlob.url,
          avif: avifBlob.url,
          thumbnail: thumbnailBlob.url,
        },
        sizes: {
          webp: webpBuffer.length,
          avif: avifBuffer.length,
          thumbnail: thumbnailBuffer.length,
        },
        deduplicated: false,
        spaceSaved: 0,
      }
    } catch (error) {
      // Record error in database
      await this.saveImageRecord(propertyId, {
        originalUrl: imageData.original_url,
        originalDescription: imageData.description,
        displayOrder,
        processingStatus: "error",
        processingError: error.message,
      })

      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Find existing processed image by hash (for deduplication)
   */
  private async findExistingProcessedImage(imageHash: string): Promise<any> {
    try {
      const result = await sql`
        SELECT webp_blob_id, avif_blob_id, thumbnail_blob_id,
               webp_url, avif_url, thumbnail_url,
               file_size_webp, file_size_avif, file_size_thumbnail
        FROM property_images_neon 
        WHERE image_hash = ${imageHash} 
          AND processing_status = 'completed'
          AND webp_blob_id IS NOT NULL
        LIMIT 1
      `
      return result[0] || null
    } catch (error) {
      return null
    }
  }

  /**
   * Save image record to database with blob references
   */
  private async saveImageRecord(propertyId: number, imageData: any): Promise<void> {
    try {
      await sql`
        INSERT INTO property_images_neon (
          property_id, original_url, original_description, display_order,
          webp_blob_id, avif_blob_id, thumbnail_blob_id,
          webp_url, avif_url, thumbnail_url, 
          original_width, original_height,
          file_size_original, file_size_webp, file_size_avif, file_size_thumbnail,
          processing_status, processing_error, image_hash
        ) VALUES (
          ${propertyId}, 
          ${imageData.originalUrl}, 
          ${imageData.originalDescription || null}, 
          ${imageData.displayOrder || 0},
          ${imageData.webpBlobId || null},
          ${imageData.avifBlobId || null},
          ${imageData.thumbnailBlobId || null},
          ${imageData.webpUrl || null}, 
          ${imageData.avifUrl || null}, 
          ${imageData.thumbnailUrl || null}, 
          ${imageData.originalWidth || null}, 
          ${imageData.originalHeight || null},
          ${imageData.fileSizeOriginal || null}, 
          ${imageData.fileSizeWebp || null}, 
          ${imageData.fileSizeAvif || null},
          ${imageData.fileSizeThumbnail || null},
          ${imageData.processingStatus || "pending"}, 
          ${imageData.processingError || null},
          ${imageData.imageHash || null}
        )
        ON CONFLICT (property_id, original_url) DO UPDATE SET
          webp_blob_id = EXCLUDED.webp_blob_id,
          avif_blob_id = EXCLUDED.avif_blob_id,
          thumbnail_blob_id = EXCLUDED.thumbnail_blob_id,
          webp_url = EXCLUDED.webp_url,
          avif_url = EXCLUDED.avif_url,
          thumbnail_url = EXCLUDED.thumbnail_url,
          processing_status = EXCLUDED.processing_status,
          processing_error = EXCLUDED.processing_error,
          image_hash = EXCLUDED.image_hash,
          updated_at = NOW()
      `
    } catch (error) {
      console.error("Failed to save image record:", error)
      throw error
    }
  }

  /**
   * Get optimized images for a property
   */
  async getPropertyImages(propertyId: number): Promise<any[]> {
    const result = await sql`
      SELECT * FROM property_images_neon 
      WHERE property_id = ${propertyId} AND processing_status = 'completed'
      ORDER BY display_order
    `

    return result.map((img) => ({
      id: img.id,
      url: img.avif_url || img.webp_url || img.original_url,
      webpUrl: img.webp_url,
      avifUrl: img.avif_url,
      thumbnailUrl: img.thumbnail_url,
      description: img.original_description,
      width: img.original_width,
      height: img.original_height,
      order: img.display_order,
      blobIds: {
        webp: img.webp_blob_id,
        avif: img.avif_blob_id,
        thumbnail: img.thumbnail_blob_id,
      },
    }))
  }
}

export const neonImageOptimizationBlob = new NeonImageOptimizationBlobService()
