import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function syncWithCheckpoints() {
  console.log("🔄 Starting property sync with checkpointing...")

  try {
    // Dynamic import to ensure environment variables are loaded
    const { propertyCacheService } = await import("../lib/property-cache-service")

    const result = await propertyCacheService.syncPropertiesWithCheckpoint(10000) // Sync all properties

    console.log(`✅ Sync completed successfully!`)
    console.log(`📊 Results:`)
    console.log(`   - Synced: ${result.synced} properties`)
    console.log(`   - Errors: ${result.errors} properties`)
    console.log(`   - Process ID: ${result.processId}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Sync failed:", error)
    process.exit(1)
  }
}

syncWithCheckpoints()
