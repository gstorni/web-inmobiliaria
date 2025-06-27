// Reprocess all existing images with new compression settings
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function reprocessAllImages() {
  console.log("🔄 Starting image reprocessing with new compression settings...")
  console.log("=".repeat(60))

  try {
    // Import services after env vars are loaded
    const { supabaseAdmin } = await import("../lib/supabase-client")
    const { imageOptimizationService } = await import("../lib/image-optimization-service")

    // 1. Test connection first
    console.log("\n1. 🔍 Testing Supabase connection...")
    const { data: testData, error: testError } = await supabaseAdmin.from("property_images").select("count").limit(1)

    if (testError) {
      throw new Error(`Supabase connection failed: ${testError.message}`)
    }

    console.log("✅ Supabase connection successful")

    // 2. Get current image statistics (with safe column selection)
    console.log("\n2. 📊 Current image statistics...")
    const { data: allImages, error: statsError } = await supabaseAdmin
      .from("property_images")
      .select("id, processing_status, original_url, webp_url, avif_url, thumbnail_url")

    if (statsError) {
      throw new Error(`Failed to get image stats: ${statsError.message}`)
    }

    const stats = {
      total: allImages?.length || 0,
      completed: allImages?.filter((img) => img.processing_status === "completed").length || 0,
      pending: allImages?.filter((img) => img.processing_status === "pending").length || 0,
      error: allImages?.filter((img) => img.processing_status === "error").length || 0,
      hasWebp: allImages?.filter((img) => img.webp_url).length || 0,
      hasAvif: allImages?.filter((img) => img.avif_url).length || 0,
    }

    console.log(`📈 Total images: ${stats.total}`)
    console.log(`✅ Completed: ${stats.completed}`)
    console.log(`⏳ Pending: ${stats.pending}`)
    console.log(`❌ Errors: ${stats.error}`)
    console.log(`🖼️ Has WebP: ${stats.hasWebp}`)
    console.log(`🖼️ Has AVIF: ${stats.hasAvif}`)

    if (stats.total === 0) {
      console.log("ℹ️  No images found to reprocess")
      console.log("\n💡 Tip: Run property sync first to get images:")
      console.log("   npm run sync-all")
      return
    }

    // 3. Show what will be reprocessed
    console.log("\n⚠️  This will reprocess images with new compression settings:")
    console.log("   • WebP quality: 85 → 60 (more compressed)")
    console.log("   • AVIF quality: 80 → 45 (much more compressed)")
    console.log("   • Auto-resize large images to max 1200px width")
    console.log("   • Better thumbnail compression")

    // 4. Mark images for reprocessing
    console.log("\n3. 🔄 Marking images for reprocessing...")

    // Mark all non-pending images as pending for reprocessing
    const { error: markError, count } = await supabaseAdmin
      .from("property_images")
      .update({
        processing_status: "pending",
        processing_error: null, // Clear any previous errors
        updated_at: new Date().toISOString(),
      })
      .neq("processing_status", "pending") // Don't update already pending ones

    if (markError) {
      throw new Error(`Failed to mark images for reprocessing: ${markError.message}`)
    }

    console.log(`✅ Marked ${count || 0} images for reprocessing`)

    // 5. Process images in batches
    console.log("\n4. 🖼️ Processing images with new compression settings...")
    let totalProcessed = 0
    let totalErrors = 0
    let batchNumber = 1
    const maxBatches = 50 // Safety limit

    while (batchNumber <= maxBatches) {
      console.log(`\n📦 Processing batch ${batchNumber}...`)

      try {
        const result = await imageOptimizationService.processPendingImages(5) // Small batches for stability
        totalProcessed += result.processed
        totalErrors += result.errors

        console.log(`   Batch ${batchNumber}: ${result.processed} processed, ${result.errors} errors`)

        if (result.processed === 0) {
          console.log("✅ All images processed!")
          break
        }

        batchNumber++

        // Small delay between batches to avoid overwhelming the system
        if (result.processed > 0) {
          console.log("   ⏳ Waiting 3 seconds before next batch...")
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      } catch (batchError) {
        console.error(`❌ Batch ${batchNumber} failed:`, batchError)
        totalErrors++
        batchNumber++

        // Continue with next batch after error
        console.log("   ⏳ Waiting 5 seconds before retrying...")
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    // 6. Final statistics
    console.log("\n5. 📊 Final statistics...")
    const { data: finalImages, error: finalError } = await supabaseAdmin
      .from("property_images")
      .select("processing_status, webp_url, avif_url, thumbnail_url")

    if (finalError) {
      console.warn("⚠️ Could not get final statistics:", finalError.message)
    } else {
      const finalStats = {
        total: finalImages?.length || 0,
        completed: finalImages?.filter((img) => img.processing_status === "completed").length || 0,
        pending: finalImages?.filter((img) => img.processing_status === "pending").length || 0,
        error: finalImages?.filter((img) => img.processing_status === "error").length || 0,
        hasWebp: finalImages?.filter((img) => img.webp_url).length || 0,
        hasAvif: finalImages?.filter((img) => img.avif_url).length || 0,
      }

      console.log(`📈 Final results:`)
      console.log(`   ✅ Completed: ${finalStats.completed}`)
      console.log(`   ⏳ Still pending: ${finalStats.pending}`)
      console.log(`   ❌ Errors: ${finalStats.error}`)
      console.log(`   🖼️ WebP images: ${finalStats.hasWebp}`)
      console.log(`   🖼️ AVIF images: ${finalStats.hasAvif}`)

      if (finalStats.error > 0) {
        console.log("\n⚠️  Some images had errors. Check the logs above for details.")
        console.log("   You can retry failed images by running this script again.")
      }

      if (finalStats.pending > 0) {
        console.log("\n⏳ Some images are still pending. Run the script again to continue processing.")
      }
    }

    // 7. Show results and next steps
    console.log("\n" + "=".repeat(60))
    console.log("🎉 Image reprocessing completed!")
    console.log(`📊 Results: ${totalProcessed} processed, ${totalErrors} errors`)

    console.log("\n💡 Next steps:")
    console.log("   • Visit /cache-dashboard to see detailed statistics")
    console.log("   • Test the optimized images on your properties page")
    console.log("   • Check Supabase Storage bucket for new compressed images")
  } catch (error) {
    console.error("❌ Reprocessing failed:", error)
    console.log("\n🔧 Troubleshooting:")
    console.log("   1. Make sure you've run the schema update:")
    console.log("      Copy scripts/update-images-schema.sql to Supabase SQL editor")
    console.log("   2. Check your environment variables:")
    console.log("      npm run check-env")
    console.log("   3. Verify Supabase connection and permissions")
    console.log("   4. Check if property_images table exists in Supabase")
    process.exit(1)
  }
}

// Run reprocessing
reprocessAllImages().catch(console.error)
