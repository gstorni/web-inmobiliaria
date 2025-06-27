// Setup script to initialize Supabase cache system
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables FIRST before any other imports
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔍 Loading environment variables from .env.local...")
console.log(`📁 Looking for .env.local at: ${resolve(process.cwd(), ".env.local")}`)

// Validate environment variables
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKKO_API_KEY",
]

console.log("🔍 Checking environment variables...")
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:")
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`)
  })
  console.error("\n💡 Please add these to your .env.local file:")
  console.error("   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co")
  console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
  console.error("   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
  console.error("   TOKKO_API_KEY=your_existing_tokko_key")
  process.exit(1)
}

console.log("✅ All environment variables found")
console.log(`🔗 Supabase URL: ${/* Supabase URL removed */}`)
console.log(`🔑 Anon Key: ${/* Supabase key removed */?.substring(0, 20)}...`)

async function setupSupabaseCache() {
  console.log("🚀 Setting up Supabase cache system...")
  console.log("=".repeat(50))

  try {
    // Import services AFTER environment variables are confirmed to be loaded
    const { propertyCacheService } = await import("../lib/property-cache-service")
    const { imageOptimizationService } = await import("../lib/image-optimization-service")

    // 1. Check Supabase connection
    console.log("\n1. 🔗 Checking Supabase connection...")
    const stats = await propertyCacheService.getCacheStats()
    console.log(`✅ Connected to Supabase`)
    console.log(`📊 Current cache stats:`, stats)

    // 2. Initial property sync
    console.log("\n2. 🔄 Starting initial property sync...")
    const syncResult = await propertyCacheService.syncProperties(50) // Start with 50 properties
    console.log(`✅ Sync completed: ${syncResult.synced} properties synced, ${syncResult.errors} errors`)

    // 3. Process images
    console.log("\n3. 🖼️ Processing property images...")
    const imageResult = await imageOptimizationService.processPendingImages(10)
    console.log(`✅ Image processing: ${imageResult.processed} processed, ${imageResult.errors} errors`)

    // 4. Final stats
    console.log("\n4. 📊 Final cache statistics...")
    const finalStats = await propertyCacheService.getCacheStats()
    console.log(`✅ Final stats:`, finalStats)

    console.log("\n" + "=".repeat(50))
    console.log("🎉 Supabase cache setup completed!")
    console.log("\n💡 Next steps:")
    console.log("   1. Visit /cache-dashboard to monitor the cache")
    console.log("   2. Set up cron jobs for regular syncing")
    console.log("   3. Configure image optimization schedules")
    console.log("   4. Test the fast search at /propiedades")
  } catch (error) {
    console.error("❌ Setup failed:", error)
    console.error("Stack trace:", error)
    process.exit(1)
  }
}

// Run setup
setupSupabaseCache().catch(console.error)
