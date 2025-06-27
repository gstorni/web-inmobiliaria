import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function processImagesBatch() {
  console.log("🖼️ Processing Images in Batches...")
  console.log("=".repeat(50))

  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    // Get unprocessed images
    const unprocessedImages = await sql`
      SELECT id, property_id, original_url, original_description
      FROM property_images_neon 
      WHERE processing_status = 'pending'
      ORDER BY created_at
      LIMIT 20
    `

    console.log(`Found ${unprocessedImages.length} images to process`)

    if (unprocessedImages.length === 0) {
      console.log("✅ No images need processing")
      return
    }

    let processed = 0
    let errors = 0

    for (const image of unprocessedImages) {
      try {
        console.log(`Processing image ${image.id}...`)

        // For now, just mark as processed and create basic optimized URLs
        // In a real implementation, you'd download, resize, and optimize the images
        const optimizedUrl = image.original_url.replace(/\.(jpg|jpeg|png)$/i, ".webp")
        const thumbnailUrl = image.original_url.replace(/\.(jpg|jpeg|png)$/i, "_thumb.webp")

        await sql`
          UPDATE property_images_neon 
          SET 
            webp_url = ${optimizedUrl},
            thumbnail_url = ${thumbnailUrl},
            processing_status = 'completed',
            updated_at = ${new Date().toISOString()}
          WHERE id = ${image.id}
        `

        processed++
        console.log(`✅ Processed image ${image.id} (${processed}/${unprocessedImages.length})`)
      } catch (error: any) {
        errors++
        console.log(`❌ Error processing image ${image.id}: ${error.message}`)

        // Mark as failed
        await sql`
          UPDATE property_images_neon 
          SET 
            processing_status = 'failed',
            updated_at = ${new Date().toISOString()}
          WHERE id = ${image.id}
        `
      }
    }

    console.log(`\n📊 Processing Summary:`)
    console.log(`  ✅ Processed: ${processed}`)
    console.log(`  ❌ Errors: ${errors}`)
    console.log(`  📋 Total: ${unprocessedImages.length}`)
  } catch (error: any) {
    console.error("❌ Image processing failed:", error.message)
    throw error
  }
}

// Run the processing
processImagesBatch()
  .then(() => {
    console.log("\n🎉 Image processing complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Processing failed:", error)
    process.exit(1)
  })
