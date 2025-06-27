import { checkpointService } from "./checkpoint-service"
import sharp from "sharp"

export class ImageOptimizationService {
  private static instance: ImageOptimizationService

  static getInstance(): ImageOptimizationService {
    if (!ImageOptimizationService.instance) {
      ImageOptimizationService.instance = new ImageOptimizationService()
    }
    return ImageOptimizationService.instance
  }

  /**
   * Process pending images with checkpointing
   */
  async processImagesWithCheckpoint(
    batchSize = 20,
    processId?: string,
    resumeFromCheckpoint = true,
  ): Promise<{ processed: number; errors: number; processId: string }> {
    const actualProcessId = processId || `image_processing_${Date.now()}`
    console.log(`🖼️ Starting image processing with checkpointing (ID: ${actualProcessId})`)

    let totalProcessed = 0
    let totalErrors = 0
    let currentBatch = 0
    const startTime = Date.now()

    try {
      // Check for existing checkpoint
      let checkpoint = null
      if (resumeFromCheckpoint) {
        checkpoint = await checkpointService.getCheckpoint("image_processing", actualProcessId)
        if (checkpoint && checkpoint.status === "running") {
          console.log(`📍 Resuming from checkpoint: ${checkpoint.processedItems} processed`)
          totalProcessed = checkpoint.processedItems
          totalErrors = checkpoint.failedItems
          currentBatch = checkpoint.currentBatch
        }
      }

      // Get total pending images count
      const { count: totalPendingImages } = await supabaseAdmin
        .from("property_images")
        .select("*", { count: "exact", head: true })
        .eq("processing_status", "pending")

      if (!totalPendingImages || totalPendingImages === 0) {
        console.log("✅ No pending images to process")
        return { processed: 0, errors: 0, processId: actualProcessId }
      }

      // Create or update checkpoint
      await checkpointService.updateCheckpoint({
        processType: "image_processing",
        processId: actualProcessId,
        processedItems: totalProcessed,
        failedItems: totalErrors,
        currentBatch,
        totalItems: totalPendingImages,
        checkpointData: { batchSize, startTime },
      })

      console.log(`📊 Total pending images: ${totalPendingImages}`)

      while (true) {
        currentBatch++

        // Get next batch of pending images
        const { data: pendingImages, error } = await supabaseAdmin
          .from("property_images")
          .select("*")
          .eq("processing_status", "pending")
          .limit(batchSize)

        if (error || !pendingImages || pendingImages.length === 0) {
          console.log("✅ No more pending images to process")
          break
        }

        console.log(`📦 Processing batch ${currentBatch}: ${pendingImages.length} images`)

        // Process images in parallel
        const results = await Promise.allSettled(pendingImages.map((image) => this.processImageWithRetry(image, 2)))

        let batchProcessed = 0
        let batchErrors = 0

        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            batchProcessed++
          } else {
            console.error(`❌ Failed to process image ${pendingImages[index].id}:`, result.reason)
            batchErrors++

            // Mark as error in database
            supabaseAdmin
              .from("property_images")
              .update({
                processing_status: "error",
                processing_error: result.reason instanceof Error ? result.reason.message : "Unknown error",
              })
              .eq("id", pendingImages[index].id)
              .catch(console.error)
          }
        })

        totalProcessed += batchProcessed
        totalErrors += batchErrors

        // Update checkpoint
        await checkpointService.updateCheckpoint({
          processType: "image_processing",
          processId: actualProcessId,
          processedItems: totalProcessed,
          failedItems: totalErrors,
          currentBatch,
          lastProcessedId: pendingImages[pendingImages.length - 1]?.id,
          checkpointData: { batchSize, startTime },
        })

        // Progress logging
        const progress = checkpointService.getProgressInfo(
          {
            processType: "image_processing",
            processId: actualProcessId,
            status: "running",
            totalItems: totalPendingImages,
            processedItems: totalProcessed,
            failedItems: totalErrors,
            currentBatch,
            checkpointData: {},
            errorLog: [],
            startedAt: new Date(startTime).toISOString(),
            updatedAt: new Date().toISOString(),
          },
          startTime,
        )

        console.log(
          `✅ Progress: ${progress.percentage.toFixed(1)}% (${totalProcessed}/${totalPendingImages}) - Rate: ${progress.processingRate?.toFixed(1) || "N/A"} images/sec`,
        )

        if (progress.estimatedTimeRemaining) {
          const eta = new Date(Date.now() + progress.estimatedTimeRemaining * 1000)
          console.log(`⏱️ ETA: ${eta.toLocaleTimeString()}`)
        }

        // Brief pause between batches
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Complete checkpoint
      await checkpointService.completeCheckpoint("image_processing", actualProcessId, "completed")

      console.log(`🎉 Image processing completed: ${totalProcessed} processed, ${totalErrors} errors`)
      return { processed: totalProcessed, errors: totalErrors, processId: actualProcessId }
    } catch (error) {
      console.error("❌ Image processing failed:", error)

      // Mark checkpoint as failed
      await checkpointService.completeCheckpoint("image_processing", actualProcessId, "failed")
      await checkpointService.updateCheckpoint({
        processType: "image_processing",
        processId: actualProcessId,
        processedItems: totalProcessed,
        failedItems: totalErrors,
        currentBatch,
        checkpointData: { batchSize, startTime },
        errorMessage: error instanceof Error ? error.message : "Unknown processing error",
      })

      throw error
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async processPendingImages(batchSize = 10): Promise<{ processed: number; errors: number }> {
    const result = await this.processImagesWithCheckpoint(batchSize)
    return { processed: result.processed, errors: result.errors }
  }

  /**
   * Process image with retry logic
   */
  private async processImageWithRetry(image: any, maxRetries = 2): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.processImageFast(image)
        return // Success
      } catch (error) {
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed for image ${image.id}:`, error)

        if (attempt === maxRetries) {
          throw error
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }
    }
  }

  /**
   * Optimized image processing with aggressive compression
   */
  private async processImageFast(image: any): Promise<void> {
    const startTime = Date.now()

    // Mark as processing
    await supabaseAdmin.from("property_images").update({ processing_status: "processing" }).eq("id", image.id)

    try {
      // Download with timeout and better error handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

      const response = await fetch(image.original_url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ImageOptimizer/1.0)",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const originalBuffer = Buffer.from(await response.arrayBuffer())
      const originalSize = originalBuffer.length

      // Skip tiny images (likely placeholders)
      if (originalSize < 1024) {
        throw new Error("Image too small (likely placeholder)")
      }

      // Get metadata quickly
      const metadata = await sharp(originalBuffer).metadata()
      const { width, height, format } = metadata

      // Skip if already very small
      if (width && width < 200) {
        throw new Error("Image dimensions too small")
      }

      // Determine optimal size (more aggressive resizing)
      const maxWidth = width && width > 800 ? 800 : width // Reduced from 1200 to 800
      const shouldResize = width && width > 800

      // Create Sharp instance once and reuse
      const sharpInstance = sharp(originalBuffer)

      if (shouldResize) {
        sharpInstance.resize(maxWidth, null, {
          withoutEnlargement: true,
          fit: "inside",
          kernel: sharp.kernel.lanczos3, // Faster kernel
        })
      }

      // Generate all formats in parallel with more aggressive compression
      const [webpBuffer, avifBuffer, thumbnailBuffer] = await Promise.all([
        // WebP - very aggressive
        sharpInstance
          .clone()
          .webp({
            quality: 50, // Reduced from 60
            effort: 4, // Reduced from 6 for speed
            smartSubsample: true,
            reductionEffort: 4, // Reduced from 6
            nearLossless: false,
            alphaQuality: 50,
          })
          .toBuffer(),

        // AVIF - maximum compression
        sharpInstance
          .clone()
          .avif({
            quality: 35, // Reduced from 45
            effort: 6, // Reduced from 9 for speed
            chromaSubsampling: "4:2:0",
            speed: 2, // Faster than 0
          })
          .toBuffer(),

        // Thumbnail - very small
        sharp(originalBuffer)
          .resize(200, null, {
            // Reduced from 300
            withoutEnlargement: true,
            fit: "inside",
            kernel: sharp.kernel.nearest, // Fastest kernel for thumbnails
          })
          .webp({
            quality: 40, // Reduced from 50
            effort: 2, // Much faster
            smartSubsample: true,
          })
          .toBuffer(),
      ])

      // Calculate compression ratios
      const webpRatio = (((originalSize - webpBuffer.length) / originalSize) * 100).toFixed(1)
      const avifRatio = (((originalSize - avifBuffer.length) / originalSize) * 100).toFixed(1)

      // Upload all files in parallel
      const baseFileName = `property-${image.property_id}-${image.id}-${Date.now()}`

      const [webpUpload, avifUpload, thumbnailUpload] = await Promise.all([
        this.uploadToStorageFast(`${baseFileName}.webp`, webpBuffer, "image/webp"),
        this.uploadToStorageFast(`${baseFileName}.avif`, avifBuffer, "image/avif"),
        this.uploadToStorageFast(`${baseFileName}-thumb.webp`, thumbnailBuffer, "image/webp"),
      ])

      // Update database
      await supabaseAdmin
        .from("property_images")
        .update({
          webp_url: webpUpload.publicUrl,
          avif_url: avifUpload.publicUrl,
          thumbnail_url: thumbnailUpload.publicUrl,
          original_width: width,
          original_height: height,
          file_size_original: originalSize,
          file_size_webp: webpBuffer.length,
          file_size_avif: avifBuffer.length,
          processing_status: "completed",
          processing_error: null,
        })
        .eq("id", image.id)

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`✅ Image ${image.id} processed in ${duration}s`)
      console.log(
        `📊 ${(originalSize / 1024).toFixed(0)}KB → WebP ${(webpBuffer.length / 1024).toFixed(0)}KB (${webpRatio}%) → AVIF ${(avifBuffer.length / 1024).toFixed(0)}KB (${avifRatio}%)`,
      )
    } catch (error) {
      console.error(`❌ Image processing failed for ${image.id}:`, error)
      throw error
    }
  }

  /**
   * Faster upload with better error handling
   */
  private async uploadToStorageFast(
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ publicUrl: string }> {
    const { data, error } = await supabaseAdmin.storage.from("property-images").upload(fileName, buffer, {
      contentType,
      upsert: true,
      duplex: "half", // Performance optimization
    })

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`)
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("property-images").getPublicUrl(fileName)

    return { publicUrl }
  }

  /**
   * Clean up old/unused images
   */
  async cleanupImages(): Promise<{ deleted: number }> {
    console.log("🧹 Cleaning up old images")

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: oldImages, error } = await supabaseAdmin
      .from("property_images")
      .select("*")
      .eq("processing_status", "error")
      .lt("created_at", thirtyDaysAgo.toISOString())

    if (error || !oldImages) {
      console.error("❌ Failed to fetch old images:", error)
      return { deleted: 0 }
    }

    let deleted = 0

    // Delete in parallel
    const deletePromises = oldImages.map(async (image) => {
      try {
        // Delete from storage in parallel
        const deleteOps = []
        if (image.webp_url) deleteOps.push(this.deleteFromStorage(image.webp_url))
        if (image.avif_url) deleteOps.push(this.deleteFromStorage(image.avif_url))
        if (image.thumbnail_url) deleteOps.push(this.deleteFromStorage(image.thumbnail_url))

        await Promise.all(deleteOps)

        // Delete from database
        await supabaseAdmin.from("property_images").delete().eq("id", image.id)
        return true
      } catch (error) {
        console.error(`❌ Failed to delete image ${image.id}:`, error)
        return false
      }
    })

    const results = await Promise.allSettled(deletePromises)
    deleted = results.filter((r) => r.status === "fulfilled" && r.value).length

    console.log(`✅ Cleaned up ${deleted} old images`)
    return { deleted }
  }

  private async deleteFromStorage(url: string): Promise<void> {
    const fileName = this.extractFileNameFromUrl(url)
    await supabaseAdmin.storage.from("property-images").remove([fileName])
  }

  private extractFileNameFromUrl(url: string): string {
    return url.split("/").pop() || ""
  }
}

export const imageOptimizationService = ImageOptimizationService.getInstance()
