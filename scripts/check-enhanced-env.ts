#!/usr/bin/env tsx

/**
 * Environment variable checker for enhanced monitoring setup
 * Run this before setup-enhanced-monitoring.ts
 */

import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKKO_API_KEY",
]

const optionalEnvVars = ["REDIS_URL", "REDIS_HOST", "REDIS_PORT", "REDIS_TTL", "CACHE_WARMUP_SIZE"]

console.log("🔍 Enhanced Monitoring Environment Check")
console.log("=".repeat(50))

// Check required variables
console.log("\n📋 Required Variables:")
let allRequired = true

requiredEnvVars.forEach((varName) => {
  const value = process.env[varName]
  if (value) {
    const preview = value.length > 15 ? `${value.substring(0, 15)}...` : value
    console.log(`✅ ${varName}: ${preview}`)
  } else {
    console.log(`❌ ${varName}: NOT SET`)
    allRequired = false
  }
})

// Check optional variables
console.log("\n🔧 Optional Variables (Redis & Performance):")
let hasRedis = false

optionalEnvVars.forEach((varName) => {
  const value = process.env[varName]
  if (value) {
    const preview = value.length > 15 ? `${value.substring(0, 15)}...` : value
    console.log(`✅ ${varName}: ${preview}`)
    if (varName.includes("REDIS")) hasRedis = true
  } else {
    console.log(`⚪ ${varName}: Not set (optional)`)
  }
})

console.log("=".repeat(50))

// Summary
if (allRequired) {
  console.log("🎉 All required environment variables are set!")

  if (hasRedis) {
    console.log("🚀 Redis configuration detected - Full enhanced caching available")
  } else {
    console.log("📦 No Redis - Will use Supabase-only caching (still very fast!)")
  }

  console.log("\n✅ Ready to run: npm run setup-enhanced-monitoring")
} else {
  console.log("❌ Missing required environment variables!")
  console.log("\n💡 Please update your .env.local file with:")
  console.log("NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
  console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
  console.log("TOKKO_API_KEY=your_existing_tokko_key")
  console.log("\n📍 Get Supabase keys from your project dashboard:")
  console.log("   Settings > API > Project URL & API Keys")
}

// Redis setup guidance
if (!hasRedis) {
  console.log("\n💡 Optional: To enable Redis for even better performance:")
  console.log("   • For local development: Install Redis locally")
  console.log("   • For production: Use Upstash Redis (free tier available)")
  console.log("   • Add REDIS_URL or REDIS_HOST/REDIS_PORT to .env.local")
}
