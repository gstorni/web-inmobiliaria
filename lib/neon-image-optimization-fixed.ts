import { sql } from "./neon-client-fixed"
import sharp from "sharp"

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
    provider: "neon" | "external"
    cdnUrl?: string
  }
}

export class NeonImageOptimizationService {
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
      provider: (process.env.IMAGE_STORAGE_PROVIDER as "neon" | "external") || "neon",
      cdnUrl: process.env.IMAGE_CDN_URL,
    },
  }

  /**
   * Process images for a property with Neon storage
   */
  async processPropertyImages(
    propertyId: number,
    images: any[],
  ): Promise<{
    processed: number
    errors: number
    details: any[]
  }> {
    let processed = 0
    let errors = 0
    const details: any[] = []

    for (const [index, image] of images.entries()) {
      try {
        const result = await this.processImage(propertyId, image, index)
        details.push(result)
        processed++
      } catch (error) {
        console.error(`Failed to process image ${index} for property ${propertyId}:`, error)
        details.push({
          index,
          error: error.message,
          originalUrl: image.original_url,
        })
        errors++
      }
    }

    return { processed, errors, details }
  }

  /**
   * Process individual image with multiple format generation
   */
  private async processImage(propertyId: number, imageData: any, displayOrder: number): Promise<any> {
    const startTime = Date.now()

    try {
      // Download original image
      const originalBuffer = await this.downloadImage(imageData.original_url)
      const originalSize = originalBuffer.length

      // Get image metadata
      const metadata = await sharp(originalBuffer).metadata()
      const { width, height, format } = metadata

      // Skip if image is too small
      if (width && width < 200) {
        throw new Error("Image too small for processing")
      }

      // Determine optimal dimensions
      const targetWidth = width && width > this.config.sizes.maxWidth ? this.config.sizes.maxWidth : width

      // Create Sharp instance
      let sharpInstance = sharp(originalBuffer)

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
        sharp(originalBuffer)
          .resize(this.config.sizes.thumbnailWidth, null, {
            withoutEnlargement: true,
            fit: "inside",
          })
          .webp({ quality: this.config.quality.thumbnail })
          .toBuffer(),
      ])

      // Store optimized images
      const urls = await this.storeOptimizedImages(propertyId, displayOrder, {
        webp: webpBuffer,
        avif: avifBuffer,
        thumbnail: thumbnailBuffer,
      })

      // Save to Neon database using tagged template literals
      await this.saveImageRecord(propertyId, {
        originalUrl: imageData.original_url,
        originalDescription: imageData.description,
        displayOrder,
        webpUrl: urls.webp,
        avifUrl: urls.avif,
        thumbnailUrl: urls.thumbnail,
        originalWidth: width,
        originalHeight: height,
        fileSizeOriginal: originalSize,
        fileSizeWebp: webpBuffer.length,
        fileSizeAvif: avifBuffer.length,
        processingStatus: "completed",
      })

      const processingTime = Date.now() - startTime
      console.log(`✅ Processed image for property ${propertyId} in ${processingTime}ms`)

      return {
        success: true,
        originalUrl: imageData.original_url,
        urls,
        sizes: {
          original: originalSize,
          webp: webpBuffer.length,
          avif: avifBuffer.length,
          thumbnail: thumbnailBuffer.length,
        },
        processingTime,
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

      throw error
    }
  }

  /**
   * Download image with retry logic
   */
  private async downloadImage(url: string, maxRetries = 3): Promise<Buffer> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ImageOptimizer/1.0)",
          },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return Buffer.from(await response.arrayBuffer())
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`Failed to download image after ${maxRetries} attempts: ${error.message}`)
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }

    throw new Error("Download failed")
  }

  /**
   * Store optimized images (Neon or external storage)
   */
  private async storeOptimizedImages(
    propertyId: number,
    displayOrder: number,
    buffers: {
      webp: Buffer
      avif: Buffer
      thumbnail: Buffer
    },
  ): Promise<{ webp: string; avif: string; thumbnail: string }> {
    if (this.config.storage.provider === "external" && this.config.storage.cdnUrl) {
      // Store in external CDN/storage
      return this.storeInExternalStorage(propertyId, displayOrder, buffers)
    } else {
      // Store in Neon as base64 (for development/small scale)
      return this.storeInNeonStorage(propertyId, displayOrder, buffers)
    }
  }

  private async storeInExternalStorage(propertyId: number, displayOrder: number, buffers: any): Promise<any> {
    // Implementation for external storage (S3, Cloudinary, etc.)
    // This would upload to your preferred CDN
    const baseUrl = this.config.storage.cdnUrl
    const timestamp = Date.now()

    // For now, return placeholder URLs - implement actual upload logic
    return {
      webp: `${baseUrl}/properties/${propertyId}/${timestamp}-${displayOrder}.webp`,
      avif: `${baseUrl}/properties/${propertyId}/${timestamp}-${displayOrder}.avif`,
      thumbnail: `${baseUrl}/properties/${propertyId}/${timestamp}-${displayOrder}-thumb.webp`,
    }
  }

  private async storeInNeonStorage(propertyId: number, displayOrder: number, buffers: any): Promise<any> {
    // Store as base64 in Neon for development
    const timestamp = Date.now()

    return {
      webp: `data:image/webp;base64,${buffers.webp.toString("base64")}`,
      avif: `data:image/avif;base64,${buffers.avif.toString("base64")}`,
      thumbnail: `data:image/webp;base64,${buffers.thumbnail.toString("base64")}`,
    }
  }

  /**
   * Save image record to Neon database using tagged template literals
   */
  private async saveImageRecord(propertyId: number, imageData: any): Promise<void> {
    try {
      await sql`
        INSERT INTO property_images_neon (
          property_id, original_url, original_description, display_order,
          webp_url, avif_url, thumbnail_url, original_width, original_height,
          file_size_original, file_size_webp, file_size_avif,
          processing_status, processing_error
        ) VALUES (
          ${propertyId}, 
          ${imageData.originalUrl}, 
          ${imageData.originalDescription || null}, 
          ${imageData.displayOrder || 0},
          ${imageData.webpUrl || null}, 
          ${imageData.avifUrl || null}, 
          ${imageData.thumbnailUrl || null}, 
          ${imageData.originalWidth || null}, 
          ${imageData.originalHeight || null},
          ${imageData.fileSizeOriginal || null}, 
          ${imageData.fileSizeWebp || null}, 
          ${imageData.fileSizeAvif || null},
          ${imageData.processingStatus || "pending"}, 
          ${imageData.processingError || null}
        )
        ON CONFLICT (property_id, original_url) DO UPDATE SET
          webp_url = EXCLUDED.webp_url,
          avif_url = EXCLUDED.avif_url,
          thumbnail_url = EXCLUDED.thumbnail_url,
          processing_status = EXCLUDED.processing_status,
          processing_error = EXCLUDED.processing_error,
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
    }))
  }

  /**
   * Batch process pending images
   */
  async processPendingImages(batchSize = 10): Promise<{
    processed: number
    errors: number
    remaining: number
  }> {
    // Get pending images
    const pendingImages = await sql`
      SELECT DISTINCT property_id 
      FROM property_images_neon 
      WHERE processing_status = 'pending'
      LIMIT ${batchSize}
    `

    let totalProcessed = 0
    let totalErrors = 0

    for (const { property_id } of pendingImages) {
      try {
        // Get all pending images for this property
        const propertyImages = await sql`
          SELECT * FROM property_images_neon 
          WHERE property_id = ${property_id} AND processing_status = 'pending'
          ORDER BY display_order
        `

        // Process each image
        for (const img of propertyImages) {
          try {
            await this.processImage(
              property_id,
              {
                original_url: img.original_url,
                description: img.original_description,
              },
              img.display_order,
            )
            totalProcessed++
          } catch (error) {
            console.error(`Failed to process image ${img.id}:`, error)
            totalErrors++
          }
        }
      } catch (error) {
        console.error(`Failed to process images for property ${property_id}:`, error)
        totalErrors++
      }
    }

    // Get remaining count
    const remainingResult = await sql`
      SELECT COUNT(*) as count FROM property_images_neon WHERE processing_status = 'pending'
    `
    const remaining = remainingResult[0]?.count || 0

    return { processed: totalProcessed, errors: totalErrors, remaining }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<any> {
    const stats = await sql`
      SELECT 
        processing_status,
        COUNT(*) as count,
        AVG(file_size_original) as avg_original_size,
        AVG(file_size_webp) as avg_webp_size,
        AVG(file_size_avif) as avg_avif_size
      FROM property_images_neon 
      GROUP BY processing_status
    `

    return stats.reduce((acc, stat) => {
      acc[stat.processing_status] = {
        count: stat.count,
        avgOriginalSize: Math.round(stat.avg_original_size || 0),
        avgWebpSize: Math.round(stat.avg_webp_size || 0),
        avgAvifSize: Math.round(stat.avg_avif_size || 0),
      }
      return acc
    }, {})
  }
}

export const neonImageOptimization = new NeonImageOptimizationService()
