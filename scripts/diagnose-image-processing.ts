import { sql } from "@/lib/neon-client"
import { neonImageOptimizationBlob } from "@/lib/neon-image-optimization-blob"
import { secureTokkoClient } from "@/lib/enhanced-tokko-client"

interface ImageDiagnostic {
  propertyId: number
  originalImages: {
    count: number
    urls: string[]
    accessible: boolean[]
  }
  processedImages: {
    count: number
    formats: string[]
    sizes: { [format: string]: number }
  }
  processingStatus: {
    pending: number
    completed: number
    error: number
    errorDetails: any[]
  }
  recommendations: string[]
}

export class ImageProcessingDiagnostic {
  async diagnoseProperty(propertyId: number): Promise<ImageDiagnostic> {
    console.log(`🖼️ Diagnosing image processing for property ${propertyId}...`)

    const diagnostic: ImageDiagnostic = {
      propertyId,
      originalImages: { count: 0, urls: [], accessible: [] },
      processedImages: { count: 0, formats: [], sizes: {} },
      processingStatus: { pending: 0, completed: 0, error: 0, errorDetails: [] },
      recommendations: [],
    }

    // Get original images from API
    await this.checkOriginalImages(propertyId, diagnostic)

    // Check processed images in database
    await this.checkProcessedImages(propertyId, diagnostic)

    // Generate recommendations
    this.generateImageRecommendations(diagnostic)

    return diagnostic
  }

  private async checkOriginalImages(propertyId: number, diagnostic: ImageDiagnostic): Promise<void> {
    try {
      console.log(`📡 Checking original images from API...`)

      const apiProperty = await secureTokkoClient.getProperty(propertyId)

      if (apiProperty?.photos) {
        diagnostic.originalImages.count = apiProperty.photos.length
        diagnostic.originalImages.urls = apiProperty.photos.map((p) => p.image)

        // Test accessibility of original images
        console.log(`🔗 Testing accessibility of ${diagnostic.originalImages.count} images...`)

        for (const url of diagnostic.originalImages.urls) {
          try {
            const response = await fetch(url, { method: "HEAD" })
            diagnostic.originalImages.accessible.push(response.ok)
            if (!response.ok) {
              console.log(`❌ Image not accessible: ${url} (${response.status})`)
            }
          } catch (error) {
            diagnostic.originalImages.accessible.push(false)
            console.log(`❌ Image fetch error: ${url}`)
          }
        }

        const accessibleCount = diagnostic.originalImages.accessible.filter(Boolean).length
        console.log(`✅ ${accessibleCount}/${diagnostic.originalImages.count} images are accessible`)
      } else {
        console.log(`❌ No images found in API response`)
      }
    } catch (error: any) {
      console.error(`❌ Error checking original images:`, error.message)
    }
  }

  private async checkProcessedImages(propertyId: number, diagnostic: ImageDiagnostic): Promise<void> {
    try {
      console.log(`💾 Checking processed images in database...`)

      const processedImages = await sql`
        SELECT 
          original_url,
          processing_status,
          webp_url,
          avif_url,
          thumbnail_url,
          file_size_original,
          file_size_webp,
          file_size_avif,
          file_size_thumbnail,
          processing_error,
          created_at,
          updated_at
        FROM property_images_neon 
        WHERE property_id = ${propertyId}
        ORDER BY display_order
      `

      diagnostic.processedImages.count = processedImages.length

      // Count by status
      for (const img of processedImages) {
        switch (img.processing_status) {
          case "pending":
            diagnostic.processingStatus.pending++
            break
          case "completed":
            diagnostic.processingStatus.completed++
            break
          case "error":
            diagnostic.processingStatus.error++
            diagnostic.processingStatus.errorDetails.push({
              url: img.original_url,
              error: img.processing_error,
              updatedAt: img.updated_at,
            })
            break
        }

        // Check available formats
        if (img.webp_url && !diagnostic.processedImages.formats.includes("webp")) {
          diagnostic.processedImages.formats.push("webp")
          diagnostic.processedImages.sizes.webp =
            (diagnostic.processedImages.sizes.webp || 0) + (img.file_size_webp || 0)
        }

        if (img.avif_url && !diagnostic.processedImages.formats.includes("avif")) {
          diagnostic.processedImages.formats.push("avif")
          diagnostic.processedImages.sizes.avif =
            (diagnostic.processedImages.sizes.avif || 0) + (img.file_size_avif || 0)
        }

        if (img.thumbnail_url && !diagnostic.processedImages.formats.includes("thumbnail")) {
          diagnostic.processedImages.formats.push("thumbnail")
          diagnostic.processedImages.sizes.thumbnail =
            (diagnostic.processedImages.sizes.thumbnail || 0) + (img.file_size_thumbnail || 0)
        }
      }

      console.log(`📊 Processing Status:`)
      console.log(`   Pending: ${diagnostic.processingStatus.pending}`)
      console.log(`   Completed: ${diagnostic.processingStatus.completed}`)
      console.log(`   Error: ${diagnostic.processingStatus.error}`)
      console.log(`   Formats: ${diagnostic.processedImages.formats.join(", ")}`)
    } catch (error: any) {
      console.error(`❌ Error checking processed images:`, error.message)
    }
  }

  private generateImageRecommendations(diagnostic: ImageDiagnostic): void {
    const recommendations: string[] = []

    // Original image issues
    const inaccessibleCount = diagnostic.originalImages.accessible.filter((a) => !a).length
    if (inaccessibleCount > 0) {
      recommendations.push(`🔗 ${inaccessibleCount} original images are not accessible - check URLs`)
    }

    // Processing issues
    if (diagnostic.processingStatus.pending > 0) {
      recommendations.push(
        `⏳ ${diagnostic.processingStatus.pending} images are pending processing - run image processing job`,
      )
    }

    if (diagnostic.processingStatus.error > 0) {
      recommendations.push(`❌ ${diagnostic.processingStatus.error} images failed processing - check error details`)
    }

    // Format optimization
    if (!diagnostic.processedImages.formats.includes("avif")) {
      recommendations.push(`🎯 No AVIF format available - enable AVIF processing for better compression`)
    }

    if (!diagnostic.processedImages.formats.includes("webp")) {
      recommendations.push(`🎯 No WebP format available - enable WebP processing for better compatibility`)
    }

    // Performance
    if (diagnostic.originalImages.count > 0 && diagnostic.processingStatus.completed === 0) {
      recommendations.push(`⚡ No images processed yet - run initial image processing`)
    }

    diagnostic.recommendations = recommendations
  }

  async fixImageProcessing(propertyId: number): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔧 Attempting to fix image processing for property ${propertyId}...`)

      // Get original images from API
      const apiProperty = await secureTokkoClient.getProperty(propertyId)

      if (!apiProperty?.photos || apiProperty.photos.length === 0) {
        return { success: false, message: "No images found in API response" }
      }

      let processedCount = 0
      let errorCount = 0

      for (let i = 0; i < apiProperty.photos.length; i++) {
        const photo = apiProperty.photos[i]

        try {
          // Download image
          const response = await fetch(photo.image)
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`)
          }

          const buffer = Buffer.from(await response.arrayBuffer())

          // Process image
          const result = await neonImageOptimizationBlob.processImage(
            propertyId,
            {
              original_url: photo.image,
              description: photo.description || "",
              display_order: i,
              buffer,
            },
            i,
          )

          if (result.success) {
            processedCount++
            console.log(`✅ Processed image ${i + 1}/${apiProperty.photos.length}`)
          } else {
            errorCount++
            console.log(`❌ Failed to process image ${i + 1}: ${result.error}`)
          }
        } catch (error: any) {
          errorCount++
          console.log(`❌ Error processing image ${i + 1}:`, error.message)
        }
      }

      return {
        success: processedCount > 0,
        message: `Processed ${processedCount}/${apiProperty.photos.length} images (${errorCount} errors)`,
      }
    } catch (error: any) {
      console.error(`❌ Fix image processing error:`, error.message)
      return { success: false, message: error.message }
    }
  }

  async runBatchDiagnostic(propertyIds: number[] = []): Promise<void> {
    console.log(`🔍 Running batch image processing diagnostic...`)

    if (propertyIds.length === 0) {
      const sampleProperties = await sql`
        SELECT tokko_id FROM properties_cache 
        WHERE tokko_id IN (
          SELECT DISTINCT property_id FROM property_images_neon 
          WHERE processing_status != 'completed'
        )
        LIMIT 10
      `
      propertyIds = sampleProperties.map((p) => p.tokko_id)
    }

    console.log(`📋 Diagnosing ${propertyIds.length} properties...`)

    let totalOriginal = 0
    let totalProcessed = 0
    let totalErrors = 0

    for (const propertyId of propertyIds) {
      console.log(`\n${"=".repeat(50)}`)
      console.log(`🖼️ PROPERTY ${propertyId} IMAGE DIAGNOSTIC`)
      console.log(`${"=".repeat(50)}`)

      const diagnostic = await this.diagnoseProperty(propertyId)

      totalOriginal += diagnostic.originalImages.count
      totalProcessed += diagnostic.processingStatus.completed
      totalErrors += diagnostic.processingStatus.error

      console.log(`\n📊 SUMMARY:`)
      console.log(`   Original: ${diagnostic.originalImages.count}`)
      console.log(`   Processed: ${diagnostic.processingStatus.completed}`)
      console.log(`   Pending: ${diagnostic.processingStatus.pending}`)
      console.log(`   Errors: ${diagnostic.processingStatus.error}`)

      if (diagnostic.recommendations.length > 0) {
        console.log(`\n💡 RECOMMENDATIONS:`)
        diagnostic.recommendations.forEach((rec) => console.log(`   ${rec}`))
      }
    }

    console.log(`\n${"=".repeat(60)}`)
    console.log(`📊 BATCH SUMMARY`)
    console.log(`${"=".repeat(60)}`)
    console.log(`Total Original Images: ${totalOriginal}`)
    console.log(`Total Processed Images: ${totalProcessed}`)
    console.log(`Total Errors: ${totalErrors}`)
    console.log(`Processing Rate: ${totalOriginal > 0 ? ((totalProcessed / totalOriginal) * 100).toFixed(1) : 0}%`)
  }
}

export const imageProcessingDiagnostic = new ImageProcessingDiagnostic()

// Run diagnostic if called directly
if (require.main === module) {
  imageProcessingDiagnostic
    .runBatchDiagnostic()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Diagnostic failed:", error)
      process.exit(1)
    })
}
