// Incremental sync script - syncs only new/updated properties
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function incrementalSync() {
  console.log("🔄 Starting incremental property sync...")
  console.log("=".repeat(50))

  try {
    const { propertyCacheService } = await import("../lib/property-cache-service")
    const { imageOptimizationService } = await import("../lib/image-optimization-service")

    // 1. Get current stats
    const initialStats = await propertyCacheService.getCacheStats()
    console.log(`📊 Current: ${initialStats.totalProperties} properties, ${initialStats.pendingImages} pending images`)

    // 2. Sync recent properties (last 100 from API)
    console.log("\n🔄 Syncing recent properties...")
    const syncResult = await propertyCacheService.syncProperties(100)
    console.log(`✅ Incremental sync: ${syncResult.synced} new/updated, ${syncResult.errors} errors`)

    // 3. Process pending images
    console.log("\n🖼️ Processing pending images...")
    const imageResult = await imageOptimizationService.processPendingImages(20)
    console.log(`✅ Images processed: ${imageResult.processed} processed, ${imageResult.errors} errors`)

    // 4. Final stats
    const finalStats = await propertyCacheService.getCacheStats()
    console.log(`\n📊 Final: ${finalStats.totalProperties} properties, ${finalStats.pendingImages} pending images`)
  } catch (error) {
    console.error("❌ Incremental sync failed:", error)
    process.exit(1)
  }
}

incrementalSync().catch(console.error)
