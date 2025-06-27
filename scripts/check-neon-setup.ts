#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function checkNeonSetup() {
  console.log("🔍 CHECKING NEON CACHE SETUP")
  console.log("=".repeat(40))

  // Check environment variables
  console.log("\n📋 Environment Variables:")
  const envVars = ["DATABASE_URL", "REDIS_URL", "TOKKO_API_KEY", "REDIS_MAX_MEMORY", "HOT_PROPERTY_THRESHOLD"]

  for (const envVar of envVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: configured`)
    } else {
      console.log(`❌ ${envVar}: missing`)
    }
  }

  // Test Neon connection
  console.log("\n🔌 Testing Neon Connection:")
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const result = await sql`SELECT NOW() as current_time`
    console.log(`✅ Neon connection successful: ${result[0].current_time}`)
  } catch (error) {
    console.log(`❌ Neon connection failed: ${error.message}`)
  }

  // Test Redis connection (if configured)
  if (process.env.REDIS_URL) {
    console.log("\n🔴 Testing Redis Connection:")
    try {
      const Redis = (await import("ioredis")).default
      const redis = new Redis(process.env.REDIS_URL)

      await redis.ping()
      console.log("✅ Redis connection successful")
      await redis.quit()
    } catch (error) {
      console.log(`❌ Redis connection failed: ${error.message}`)
    }
  } else {
    console.log("\n🔴 Redis: not configured (optional)")
  }

  // Check if tables exist
  if (process.env.DATABASE_URL) {
    console.log("\n📊 Checking Database Tables:")
    try {
      const { neon } = await import("@neondatabase/serverless")
      const sql = neon(process.env.DATABASE_URL!)

      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('properties_cache', 'property_images_neon', 'hot_properties', 'search_cache', 'performance_metrics')
      `

      const expectedTables = [
        "properties_cache",
        "property_images_neon",
        "hot_properties",
        "search_cache",
        "performance_metrics",
      ]

      for (const expectedTable of expectedTables) {
        const exists = tables.some((t) => t.table_name === expectedTable)
        if (exists) {
          const count = await sql`SELECT COUNT(*) as count FROM ${sql(expectedTable)}`
          console.log(`✅ ${expectedTable}: exists (${count[0].count} records)`)
        } else {
          console.log(`❌ ${expectedTable}: missing`)
        }
      }
    } catch (error) {
      console.log(`❌ Database check failed: ${error.message}`)
    }
  }

  console.log("\n🎯 Setup Status:")
  console.log("Run these commands in order:")
  console.log("1. npx tsx scripts/migrate-to-neon-cache-fixed.ts")
  console.log("2. npx tsx scripts/sync-properties-to-neon.ts")
  console.log("3. Visit /neon-dashboard to monitor performance")
}

checkNeonSetup().catch(console.error)
