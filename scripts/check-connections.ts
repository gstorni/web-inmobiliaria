import dotenv from "dotenv"
import Redis from "ioredis"

dotenv.config({ path: ".env.local" })

async function checkConnections() {
  console.log("🔍 Connection Diagnostic Tool")
  console.log("=".repeat(40))

  // Check .env.local file
  console.log("\n📁 Environment File Check:")
  try {
    const fs = require("fs")
    const envExists = fs.existsSync(".env.local")
    console.log(".env.local exists:", envExists ? "✅ Yes" : "❌ No")

    if (envExists) {
      const envContent = fs.readFileSync(".env.local", "utf8")
      console.log("REDIS_URL present:", envContent.includes("REDIS_URL") ? "✅ Yes" : "❌ No")
      console.log("SUPABASE_URL present:", envContent.includes("NEXT_PUBLIC_SUPABASE_URL") ? "✅ Yes" : "❌ No")
      console.log("SUPABASE_KEY present:", envContent.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "✅ Yes" : "❌ No")
    }
  } catch (error) {
    console.log("❌ Error reading .env.local:", error.message)
  }

  // Check environment variables
  console.log("\n📋 Environment Variables:")
  const redisUrl = process.env.REDIS_URL
  const supabaseUrl = null
  const supabaseKey = null

  console.log("REDIS_URL:", redisUrl ? "✅ Set" : "❌ Not set")
  console.log("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Not set")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseKey ? "✅ Set" : "❌ Not set")

  if (redisUrl) {
    console.log("Redis URL preview:", redisUrl.substring(0, 30) + "...")
  }
  if (supabaseUrl) {
    console.log("Supabase URL:", supabaseUrl)
  }

  // Test Redis connection
  console.log("\n🔴 Testing Redis Connection:")
  if (!redisUrl) {
    console.log("❌ Cannot test Redis - REDIS_URL not set")
  } else {
    try {
      const redis = new Redis(redisUrl, {
        connectTimeout: 10000,
        lazyConnect: true,
        tls: redisUrl.includes("upstash.io") ? {} : undefined,
      })

      await redis.connect()
      const result = await redis.ping()
      console.log("✅ Redis connection successful, ping:", result)

      await redis.set("test", "value", "EX", 10)
      const value = await redis.get("test")
      console.log("✅ Redis read/write test:", value === "value" ? "passed" : "failed")

      await redis.quit()
    } catch (error) {
      console.log("❌ Redis connection failed:", error.message)
    }
  }

  // Test Supabase connection
  console.log("\n🟢 Testing Supabase Connection:")
  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Cannot test Supabase - credentials not set")
  } else {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { data, error } = await supabase.from("properties_cache").select("count", { count: "exact", head: true })

      if (error) {
        console.log("❌ Supabase connection failed:", error.message)
      } else {
        console.log("✅ Supabase connection successful")
        console.log("📊 Properties in cache:", data || 0)
      }
    } catch (error) {
      console.log("❌ Supabase connection failed:", error.message)
    }
  }

  console.log("\n🔧 Next Steps:")
  if (!redisUrl) {
    console.log("1. Add REDIS_URL to your .env.local file")
    console.log("   Get it from: https://console.upstash.com/")
  }
  if (!supabaseUrl || !supabaseKey) {
    console.log("2. Add Supabase credentials to your .env.local file")
    console.log("   Get them from: https://supabase.com/dashboard/")
  }
  console.log("3. Run: npx tsx scripts/warm-redis-cache.ts")
}

checkConnections().catch(console.error)
