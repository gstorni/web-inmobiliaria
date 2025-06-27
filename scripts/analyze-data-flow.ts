import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables first
config({ path: resolve(process.cwd(), ".env.local") })

async function analyzeCompleteDataFlow() {
  console.log("🔍 Starting Comprehensive Data Flow Analysis...")
  console.log("=".repeat(60))

  // Step 1: Environment Check
  console.log("\n📋 Step 1: Environment Variables Check")
  const requiredVars = ["DATABASE_URL", "TOKKO_API_KEY"]
  let envOk = true

  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: Present (${value.length} chars)`)
    } else {
      console.log(`❌ ${varName}: MISSING`)
      envOk = false
    }
  }

  if (!envOk) {
    console.log("\n❌ Environment setup incomplete. Please fix missing variables.")
    return
  }

  // Step 2: Database Connection Test
  console.log("\n🟦 Step 2: Database Connection Test")
  let dbOk = false
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const result = await sql`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`
    console.log(`✅ Database connected - ${result[0].count} tables found`)
    dbOk = true
  } catch (error: any) {
    console.log(`❌ Database connection failed: ${error.message}`)
    return
  }

  // Step 3: Check Database Schema
  console.log("\n📊 Step 3: Database Schema Analysis")
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const tables = await sql`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `

    console.log("Database Tables:")
    for (const table of tables) {
      console.log(`  📋 ${table.table_name} (${table.column_count} columns)`)
    }

    // Check specific tables we need
    const requiredTables = ["properties", "property_images", "hot_properties"]
    for (const tableName of requiredTables) {
      const tableExists = tables.some((t) => t.table_name === tableName)
      if (tableExists) {
        const count = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`
        console.log(`  ✅ ${tableName}: ${count[0].count} records`)
      } else {
        console.log(`  ❌ ${tableName}: Missing`)
      }
    }
  } catch (error: any) {
    console.log(`❌ Schema check failed: ${error.message}`)
  }

  // Step 4: API Connection Test
  console.log("\n🌐 Step 4: Tokko API Connection Test")
  try {
    const { createSecureTokkoClient } = await import("../lib/enhanced-tokko-client-fixed")
    const client = createSecureTokkoClient(process.env.TOKKO_API_KEY)

    console.log("Testing API connection...")
    const response = await client.getProperties({ limit: "1" })
    console.log(`✅ API connected - ${response.objects?.length || 0} properties returned`)

    if (response.objects && response.objects.length > 0) {
      const property = response.objects[0]
      console.log(`  📋 Sample property: ${property.id} - ${property.publication_title}`)
      console.log(`  🖼️  Images: ${property.photos?.length || 0}`)
    }
  } catch (error: any) {
    console.log(`❌ API connection failed: ${error.message}`)
    return
  }

  // Step 5: Cache Layer Analysis
  console.log("\n🔴 Step 5: Cache Layer Analysis")

  // Test Redis if available
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST
  let redisOk = false

  if (redisUrl) {
    try {
      const { Redis } = await import("ioredis")
      const redis = new Redis(
        process.env.REDIS_URL || {
          host: process.env.REDIS_HOST || "localhost",
          port: Number.parseInt(process.env.REDIS_PORT || "6379"),
        },
      )

      await redis.ping()
      const keys = await redis.keys("property:*")
      console.log(`✅ Redis connected - ${keys.length} cached properties`)
      redisOk = true
      await redis.disconnect()
    } catch (error: any) {
      console.log(`⚠️ Redis not available: ${error.message}`)
    }
  } else {
    console.log("⚪ Redis not configured")
  }

  // Step 6: Data Flow Test with Sample Property
  console.log("\n🔄 Step 6: Data Flow Test")

  try {
    // Get a sample property ID from API
    const { createSecureTokkoClient } = await import("../lib/enhanced-tokko-client-fixed")
    const client = createSecureTokkoClient(process.env.TOKKO_API_KEY)
    const apiResponse = await client.getProperties({ limit: "1" })

    if (!apiResponse.objects || apiResponse.objects.length === 0) {
      console.log("❌ No properties available from API")
      return
    }

    const samplePropertyId = apiResponse.objects[0].id
    console.log(`Testing data flow with property ID: ${samplePropertyId}`)

    // Test each tier
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    // Tier 1: Redis (if available)
    if (redisOk) {
      try {
        const { Redis } = await import("ioredis")
        const redis = new Redis(
          process.env.REDIS_URL || {
            host: process.env.REDIS_HOST || "localhost",
            port: Number.parseInt(process.env.REDIS_PORT || "6379"),
          },
        )

        const cached = await redis.get(`property:${samplePropertyId}`)
        if (cached) {
          console.log("✅ Tier 1 (Redis): Property found in cache")
        } else {
          console.log("⚪ Tier 1 (Redis): Property not cached")
        }
        await redis.disconnect()
      } catch (error) {
        console.log("❌ Tier 1 (Redis): Error accessing cache")
      }
    }

    // Tier 2: Neon Database
    try {
      const dbProperty = await sql`SELECT * FROM properties WHERE tokko_id = ${samplePropertyId}`
      if (dbProperty.length > 0) {
        console.log("✅ Tier 2 (Neon): Property found in database")

        // Check images
        const images = await sql`SELECT * FROM property_images WHERE property_id = ${dbProperty[0].id}`
        console.log(`  🖼️  Images in DB: ${images.length}`)

        if (images.length > 0) {
          const processedImages = images.filter((img) => img.optimized_url)
          console.log(`  ✨ Processed images: ${processedImages.length}`)
        }
      } else {
        console.log("⚪ Tier 2 (Neon): Property not in database")
      }
    } catch (error: any) {
      console.log(`❌ Tier 2 (Neon): Database query failed - ${error.message}`)
    }

    // Tier 3: API (already tested above)
    console.log("✅ Tier 3 (API): Property available from source")
  } catch (error: any) {
    console.log(`❌ Data flow test failed: ${error.message}`)
  }

  // Step 7: Image Processing Analysis
  console.log("\n🖼️  Step 7: Image Processing Analysis")

  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const imageStats = await sql`
      SELECT 
        COUNT(*) as total_images,
        COUNT(CASE WHEN optimized_url IS NOT NULL THEN 1 END) as processed_images,
        COUNT(CASE WHEN thumbnail_url IS NOT NULL THEN 1 END) as thumbnails,
        COUNT(CASE WHEN webp_url IS NOT NULL THEN 1 END) as webp_images
      FROM property_images
    `

    if (imageStats.length > 0) {
      const stats = imageStats[0]
      console.log(`📊 Image Statistics:`)
      console.log(`  Total images: ${stats.total_images}`)
      console.log(`  Processed: ${stats.processed_images}`)
      console.log(`  Thumbnails: ${stats.thumbnails}`)
      console.log(`  WebP format: ${stats.webp_images}`)

      const processingRate =
        stats.total_images > 0 ? ((stats.processed_images / stats.total_images) * 100).toFixed(1) : 0
      console.log(`  Processing rate: ${processingRate}%`)
    }
  } catch (error: any) {
    console.log(`❌ Image analysis failed: ${error.message}`)
  }

  // Step 8: Performance Analysis
  console.log("\n⚡ Step 8: Performance Analysis")

  const performanceTests = [
    {
      name: "API Response",
      test: async () => {
        const start = Date.now()
        const { createSecureTokkoClient } = await import("../lib/enhanced-tokko-client-fixed")
        const client = createSecureTokkoClient(process.env.TOKKO_API_KEY)
        await client.getProperties({ limit: "1" })
        return Date.now() - start
      },
    },
    {
      name: "Database Query",
      test: async () => {
        const start = Date.now()
        const { neon } = await import("@neondatabase/serverless")
        const sql = neon(process.env.DATABASE_URL!)
        await sql`SELECT COUNT(*) FROM properties LIMIT 1`
        return Date.now() - start
      },
    },
  ]

  for (const test of performanceTests) {
    try {
      const time = await test.test()
      console.log(`  ${test.name}: ${time}ms`)
    } catch (error) {
      console.log(`  ${test.name}: Failed`)
    }
  }

  // Final Summary
  console.log("\n" + "=".repeat(60))
  console.log("📋 ANALYSIS SUMMARY")
  console.log("=".repeat(60))
  console.log("✅ Environment: Configured")
  console.log(`✅ Database: Connected (${dbOk ? "OK" : "Failed"})`)
  console.log(`✅ API: Connected`)
  console.log(`${redisOk ? "✅" : "⚪"} Redis: ${redisOk ? "Available" : "Not configured"}`)
  console.log("\n🎯 RECOMMENDATIONS:")

  if (!redisOk) {
    console.log("1. Consider setting up Redis for better performance")
  }

  console.log("2. Run image processing if images are missing")
  console.log("3. Warm up cache with popular properties")
  console.log("4. Monitor performance metrics")

  console.log("\n🚀 Next steps:")
  console.log("- Run: npx tsx scripts/sync-properties-to-neon.ts")
  console.log("- Run: npx tsx scripts/process-images-with-checkpoints.ts")
  console.log("- Visit: /enhanced-dashboard for monitoring")
}

// Run the analysis
analyzeCompleteDataFlow()
  .then(() => {
    console.log("\n✅ Analysis complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Analysis failed:", error)
    process.exit(1)
  })
