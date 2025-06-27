#!/usr/bin/env tsx

/**
 * Fixed setup script for enhanced monitoring and performance tracking
 * Loads environment variables before any imports to avoid initialization errors
 */

import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables FIRST, before any other imports
console.log("🔧 Loading environment variables...")
const envResult = config({ path: resolve(process.cwd(), ".env.local") })

if (envResult.error) {
  console.warn("⚠️ No .env.local file found, using system environment variables")
} else {
  console.log("✅ Loaded .env.local file")
}

// Check required environment variables
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKKO_API_KEY",
]

function checkEnvironmentVariables() {
  console.log("🔍 Checking environment variables...")

  const missing = requiredEnvVars.filter((varName) => !process.env[varName])

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:")
    missing.forEach((varName) => console.error(`  - ${varName}`))
    console.error("\n💡 Please add these to your .env.local file:")
    console.error("NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
    console.error("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
    console.error("TOKKO_API_KEY=your_existing_tokko_key")
    console.error("\n📍 Get Supabase keys from: Settings > API > Project URL & API Keys")
    throw new Error("Missing required environment variables")
  }

  console.log("✅ All required environment variables are present")

  // Check optional Redis variables
  const hasRedis = process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_PORT)
  if (hasRedis) {
    console.log("✅ Redis configuration detected - Enhanced caching enabled")
  } else {
    console.log("⚠️ No Redis configuration - Using Supabase-only caching")
  }
}

async function setupEnhancedMonitoring() {
  console.log("🚀 Setting up Enhanced Hybrid Caching System...")

  try {
    // Check environment variables first
    checkEnvironmentVariables()

    // NOW import the modules after environment is validated
    console.log("📦 Loading enhanced monitoring modules...")

    // Dynamic imports to avoid early initialization
    const { enhancedHybridCacheService } = await import("../lib/enhanced-hybrid-cache-service")
    const { performanceMonitor } = await import("../lib/performance-monitor")
    const { autoScalingService } = await import("../lib/auto-scaling-service")

    // 1. Initialize performance monitoring
    console.log("📊 Initializing performance monitoring...")
    performanceMonitor.recordMetric("system_startup", 1, { component: "enhanced-monitoring" })

    // 2. Test enhanced cache service
    console.log("🔧 Testing enhanced cache service...")
    const stats = enhancedHybridCacheService.getEnhancedStats()
    console.log(`✅ Cache service initialized - Mode: ${stats.mode}`)
    console.log(`📦 Redis capacity: ${stats.capacity.redisSize}/${stats.capacity.redisCapacity}`)

    // 3. Perform initial predictive warming
    console.log("🔥 Performing initial predictive warming...")
    const warmingResult = await enhancedHybridCacheService.performPredictiveWarming()
    console.log(`✅ Initial warming completed: ${warmingResult.warmed} properties warmed`)

    // 4. Test auto-scaling service
    console.log("⚖️ Testing auto-scaling service...")
    const scalingStatus = autoScalingService.getScalingStatus()
    console.log(`✅ Auto-scaling initialized with ${scalingStatus.activeRules} rules`)

    // 5. Run system health check
    console.log("🏥 Running system health check...")
    const health = performanceMonitor.getSystemHealth()
    console.log(`✅ System health: ${health.status} (Score: ${health.score}/100)`)

    if (health.issues.length > 0) {
      console.log("⚠️ Issues detected:")
      health.issues.forEach((issue) => console.log(`  - ${issue}`))
    }

    if (health.recommendations.length > 0) {
      console.log("💡 Recommendations:")
      health.recommendations.forEach((rec) => console.log(`  - ${rec}`))
    }

    // 6. Display configuration summary
    console.log("\n📋 Enhanced Hybrid Caching Configuration:")
    console.log(`  • Redis Capacity: ${stats.capacity.redisCapacity} properties`)
    console.log(`  • Search Cache TTL: 30 minutes`)
    console.log(`  • Property Cache TTL: 2 hours`)
    console.log(`  • Auto-scaling Rules: ${scalingStatus.activeRules}`)
    console.log(`  • Performance Monitoring: Active`)
    console.log(`  • Predictive Warming: Enabled`)

    console.log("\n🎉 Enhanced Hybrid Caching System setup completed successfully!")
    console.log("\n📊 Access your enhanced dashboard at: /enhanced-dashboard")
  } catch (error) {
    console.error("❌ Setup failed:", error.message)
    process.exit(1)
  }
}

// Run setup if called directly
if (require.main === module) {
  setupEnhancedMonitoring()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Setup failed:", error)
      process.exit(1)
    })
}

export { setupEnhancedMonitoring }
