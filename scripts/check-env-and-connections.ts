import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function checkEnvironmentAndConnections() {
  console.log("🔍 Checking environment variables and connections...")

  // Check required environment variables
  const requiredVars = ["DATABASE_URL", "TOKKO_API_KEY"]

  const optionalVars = ["REDIS_URL", "REDIS_HOST", "REDIS_PORT"]

  console.log("\n📋 Required Variables:")
  let missingRequired = 0

  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 30)}...`)
    } else {
      console.log(`❌ ${varName}: MISSING`)
      missingRequired++
    }
  }

  console.log("\n📋 Optional Variables:")
  for (const varName of optionalVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: ${value}`)
    } else {
      console.log(`⚪ ${varName}: Not set (optional)`)
    }
  }

  if (missingRequired > 0) {
    console.log(`\n❌ ${missingRequired} required environment variables are missing!`)
    console.log("Please check your .env.local file and ensure all required variables are set.")
    return false
  }

  // Test database connection
  console.log("\n🟦 Testing Neon Database Connection...")
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const result = await sql`SELECT 1 as test`
    console.log("✅ Neon database connection successful")
  } catch (error: any) {
    console.log("❌ Neon database connection failed:", error.message)
    return false
  }

  // Test API connection
  console.log("\n🌐 Testing Tokko API Connection...")
  try {
    const response = await fetch(`https://tokkobroker.com/api/v1/property/?key=${process.env.TOKKO_API_KEY}&limit=1`)
    if (response.ok) {
      console.log("✅ Tokko API connection successful")
    } else {
      console.log("❌ Tokko API connection failed:", response.status, response.statusText)
      return false
    }
  } catch (error: any) {
    console.log("❌ Tokko API connection failed:", error.message)
    return false
  }

  // Test Redis connection (optional)
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST
  if (redisUrl) {
    console.log("\n🔴 Testing Redis Connection...")
    try {
      const { Redis } = await import("ioredis")
      const redis = new Redis(
        process.env.REDIS_URL || {
          host: process.env.REDIS_HOST || "localhost",
          port: Number.parseInt(process.env.REDIS_PORT || "6379"),
        },
      )

      await redis.ping()
      console.log("✅ Redis connection successful")
      await redis.disconnect()
    } catch (error: any) {
      console.log("⚠️ Redis connection failed (optional):", error.message)
      console.log("   System will run in Neon-only mode")
    }
  } else {
    console.log("\n🔴 Redis not configured - running in Neon-only mode")
  }

  console.log("\n✅ All required connections are working!")
  return true
}

// Run the check
checkEnvironmentAndConnections()
  .then((success) => {
    if (success) {
      console.log("\n🎉 Environment setup is complete! You can now run the data flow analysis.")
      process.exit(0)
    } else {
      console.log("\n❌ Environment setup has issues. Please fix the above errors.")
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error("Environment check failed:", error)
    process.exit(1)
  })
