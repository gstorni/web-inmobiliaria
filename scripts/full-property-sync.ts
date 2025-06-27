// Full property sync script - syncs ALL properties from TokkoBroker
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function fullPropertySync() {
  console.log("🚀 Starting FULL property sync...")
  console.log("=".repeat(50))

  try {
    // Import services after env vars are loaded
    const { propertyCacheService } = await import("../lib/property-cache-service")
    const { imageOptimizationService } = await import("../lib/image-optimization-service")

    // 1. Get current stats
    console.log("\n1. 📊 Current cache statistics...")
    const initialStats = await propertyCacheService.getCacheStats()
    console.log(`Current properties: ${initialStats.totalProperties}`)
    console.log(`Featured properties: ${initialStats.featuredProperties}`)

    // 2. Sync ALL properties (no limit)
    console.log("\n2. 🔄 Starting FULL property sync...")
    console.log("⚠️  This may take several minutes depending on your property count")

    const syncResult = await propertyCacheService.syncProperties(10000) // High limit to get all
    console.log(`✅ Full sync completed: ${syncResult.synced} properties synced, ${syncResult.errors} errors`)

    // 3. Process images in batches
    console.log("\n3. 🖼️ Processing ALL property images...")
    let totalProcessed = 0
    let totalImageErrors = 0

    // Process images in batches of 50
    for (let i = 0; i < 10; i++) {
      console.log(`📸 Processing image batch ${i + 1}/10...`)
      const imageResult = await imageOptimizationService.processPendingImages(50)
      totalProcessed += imageResult.processed
      totalImageErrors += imageResult.errors

      if (imageResult.processed === 0) {
        console.log("✅ All images processed!")
        break
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    console.log(`✅ Image processing completed: ${totalProcessed} processed, ${totalImageErrors} errors`)

    // 4. Final statistics
    console.log("\n4. 📊 Final cache statistics...")
    const finalStats = await propertyCacheService.getCacheStats()
    console.log(`Total properties: ${finalStats.totalProperties}`)
    console.log(`Featured properties: ${finalStats.featuredProperties}`)
    console.log(`Pending images: ${finalStats.pendingImages}`)
    console.log(`Processed images: ${finalStats.processedImages}`)

    console.log("\n" + "=".repeat(50))
    console.log("🎉 FULL property sync completed!")
    console.log(`📈 Synced ${syncResult.synced} properties with ${syncResult.errors} errors`)
    console.log(`🖼️ Processed ${totalProcessed} images with ${totalImageErrors} errors`)
  } catch (error) {
    console.error("❌ Full sync failed:", error)
    process.exit(1)
  }
}

// Run full sync
fullPropertySync().catch(console.error)
