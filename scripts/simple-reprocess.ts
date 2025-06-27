// Simple image reprocessing script
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function simpleReprocess() {
  console.log("🔄 Simple image reprocessing...")

  try {
    const { supabaseAdmin } = await import("../lib/supabase-client")
    const { imageOptimizationService } = await import("../lib/image-optimization-service")

    // 1. Check if we have any images
    console.log("1. 📊 Checking images...")
    const { data: images, error } = await supabaseAdmin
      .from("property_images")
      .select("id, processing_status")
      .limit(10)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log(`Found ${images?.length || 0} images`)

    if (!images || images.length === 0) {
      console.log("No images found. Run property sync first:")
      console.log("npm run sync-all")
      return
    }

    // 2. Mark some images as pending
    console.log("2. 🔄 Marking images for reprocessing...")
    const { count } = await supabaseAdmin
      .from("property_images")
      .update({ processing_status: "pending" })
      .eq("processing_status", "completed")

    console.log(`Marked ${count || 0} images for reprocessing`)

    // 3. Process a small batch
    console.log("3. 🖼️ Processing images...")
    const result = await imageOptimizationService.processPendingImages(3)

    console.log(`✅ Processed: ${result.processed}`)
    console.log(`❌ Errors: ${result.errors}`)
  } catch (error) {
    console.error("❌ Failed:", error)
  }
}

simpleReprocess()
