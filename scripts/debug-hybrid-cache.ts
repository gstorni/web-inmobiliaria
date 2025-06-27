import { existsSync } from "fs"
import { resolve } from "path"

console.log("🔍 Safe Hybrid Cache Debug Tool")
console.log("=".repeat(50))

// Check environment first
const envPath = resolve(process.cwd(), ".env.local")
if (!existsSync(envPath)) {
  console.log("❌ .env.local file not found!")
  console.log("💡 Run: npx tsx scripts/check-env-variables.ts")
  process.exit(1)
}

// Load environment
require("dotenv").config({ path: ".env.local" })

async function debugSafely() {
  try {
    console.log("\n📋 Environment Status:")
    console.log("SUPABASE_URL:", /* Supabase URL removed */ ? "✅ Set" : "❌ Missing")
    console.log("SUPABASE_KEY:", /* Supabase key removed */ ? "✅ Set" : "❌ Missing")
    console.log("TOKKO_API_KEY:", process.env.TOKKO_API_KEY ? "✅ Set" : "❌ Missing")
    console.log("REDIS_URL:", process.env.REDIS_URL ? "✅ Set" : "❌ Missing")

    // Only test what's available
    if (/* Supabase URL removed */ && /* Supabase key removed */) {
      console.log("\n💾 Testing Supabase Connection:")
      try {
        const { createClient } = await import("@supabase/supabase-js")
        const supabase = createClient(/* Supabase URL removed */!, /* Supabase key removed */!)

        // Test basic connection
        const { data, error } = await supabase.from("properties_cache").select("count", { count: "exact", head: true })

        if (error) {
          console.log("❌ Supabase connection failed:", error.message)
          console.log("💡 Check if properties_cache table exists")
        } else {
          console.log("✅ Supabase connection successful")
          console.log(`📊 Properties in cache: ${data || 0}`)
        }

        // Test properties_with_images view
        const { data: viewData, error: viewError } = await supabase
          .from("properties_with_images")
          .select("count", { count: "exact", head: true })

        if (viewError) {
          console.log("❌ properties_with_images view missing:", viewError.message)
          console.log("💡 This is likely why search returns 0 results!")
        } else {
          console.log("✅ properties_with_images view exists")
          console.log(`📊 Properties in view: ${viewData || 0}`)
        }
      } catch (supabaseError) {
        console.log("❌ Supabase test failed:", supabaseError.message)
      }
    } else {
      console.log("⚠️ Skipping Supabase test - credentials missing")
    }

    // Test Redis if available
    if (process.env.REDIS_URL) {
      console.log("\n🔴 Testing Redis Connection:")
      try {
        const Redis = (await import("ioredis")).default
        const redis = new Redis(process.env.REDIS_URL)

        const pong = await redis.ping()
        console.log("✅ Redis connection successful:", pong)

        const keys = await redis.keys("property:*")
        console.log(`📊 Redis property keys: ${keys.length}`)

        await redis.disconnect()
      } catch (redisError) {
        console.log("❌ Redis test failed:", redisError.message)
      }
    } else {
      console.log("⚠️ Skipping Redis test - REDIS_URL missing")
    }

    // Test API endpoint if Next.js is running
    console.log("\n🌐 Testing API Endpoint:")
    try {
      const response = await fetch("http://localhost:3000/api/properties/search?limit=3")
      if (response.ok) {
        const result = await response.json()
        console.log("✅ API endpoint accessible")
        console.log(`📊 Returned ${result.properties?.length || 0} properties`)
        console.log(`📊 Cache source: ${result.meta?.cacheSource || "unknown"}`)
      } else {
        console.log("❌ API endpoint returned:", response.status, response.statusText)
      }
    } catch (apiError) {
      console.log("❌ API endpoint test failed:", apiError.message)
      console.log("💡 Make sure Next.js dev server is running (npm run dev)")
    }

    console.log("\n🔧 Next Steps:")
    console.log("1. If properties_with_images missing: Run 'npx tsx scripts/create-missing-tables.sql'")
    console.log("2. If no properties in cache: Run 'npx tsx scripts/warm-redis-cache.ts'")
    console.log("3. If API fails: Start Next.js with 'npm run dev'")
    console.log("4. If environment missing: Check .env.local file")
  } catch (error) {
    console.error("❌ Debug failed:", error.message)
  }
}

debugSafely().catch(console.error)
