// Clean bucket and reprocess all images from scratch
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function cleanAndReprocess() {
  console.log("🧹 Starting clean bucket and reprocess...")
  console.log("=".repeat(60))

  try {
    // Import services after env vars are loaded
    const { supabaseAdmin } = await import("../lib/supabase-client")
    const { imageOptimizationService } = await import("../lib/image-optimization-service")

    // 1. List all files in the bucket
    console.log("\n1. 📋 Listing all files in property-images bucket...")
    const { data: files, error: listError } = await supabaseAdmin.storage.from("property-images").list()

    if (listError) {
      throw new Error(`Failed to list files: ${listError.message}`)
    }

    console.log(`📁 Found ${files?.length || 0} files in bucket`)

    // 2. Delete all files from bucket
    if (files && files.length > 0) {
      console.log("\n2. 🗑️ Deleting all files from bucket...")

      const fileNames = files.map((file) => file.name)
      const { error: deleteError } = await supabaseAdmin.storage.from("property-images").remove(fileNames)

      if (deleteError) {
        console.warn(`⚠️ Some files couldn't be deleted: ${deleteError.message}`)
      } else {
        console.log(`✅ Deleted ${fileNames.length} files from bucket`)
      }
    }

    // 3. Reset all image records to pending
    console.log("\n3. 🔄 Resetting all image records to pending...")
    const { error: resetError, count } = await supabaseAdmin
      .from("property_images")
      .update({
        processing_status: "pending",
        webp_url: null,
        avif_url: null,
        thumbnail_url: null,
        file_size_webp: null,
        file_size_avif: null,
        processing_error: null,
      })
      .neq("processing_status", "pending")

    if (resetError) {
      throw new Error(`Failed to reset image records: ${resetError.message}`)
    }

    console.log(`✅ Reset ${count || 0} image records`)

    // 4. Process all images from scratch
    console.log("\n4. 🖼️ Processing all images from scratch with new settings...")
    let totalProcessed = 0
    let totalErrors = 0
    let batchNumber = 1

    while (true) {
      console.log(`\n📦 Processing batch ${batchNumber}...`)

      const result = await imageOptimizationService.processPendingImages(15) // Larger batches since we're starting fresh
      totalProcessed += result.processed
      totalErrors += result.errors

      console.log(`   Batch ${batchNumber}: ${result.processed} processed, ${result.errors} errors`)

      if (result.processed === 0) {
        console.log("✅ All images processed!")
        break
      }

      batchNumber++

      // Shorter delay since we're not overwriting
      console.log("   ⏳ Waiting 1 second before next batch...")
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    console.log("\n" + "=".repeat(60))
    console.log("🎉 Clean and reprocess completed!")
    console.log(`📊 Results: ${totalProcessed} processed, ${totalErrors} errors`)
  } catch (error) {
    console.error("❌ Clean and reprocess failed:", error)
    process.exit(1)
  }
}

// Run clean and reprocess
cleanAndReprocess().catch(console.error)
