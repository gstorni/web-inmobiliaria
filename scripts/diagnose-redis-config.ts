console.log("🔍 Redis Configuration Diagnosis")
console.log("================================")

// Check environment variables
console.log("\n📋 Environment Variables:")
console.log("REDIS_URL:", process.env.REDIS_URL ? "✅ Set" : "❌ Not set")
console.log("REDIS_HOST:", process.env.REDIS_HOST ? "✅ Set" : "❌ Not set")
console.log("REDIS_PORT:", process.env.REDIS_PORT ? "✅ Set" : "❌ Not set")

if (process.env.REDIS_URL) {
  console.log("REDIS_URL value:", process.env.REDIS_URL)
}

if (process.env.REDIS_HOST) {
  console.log("REDIS_HOST value:", process.env.REDIS_HOST)
  console.log("REDIS_PORT value:", process.env.REDIS_PORT || "6379 (default)")
}

// Test Redis connection manually
console.log("\n🧪 Testing Redis Connection...")

async function testRedis() {
  try {
    const Redis = require("ioredis")

    let redis
    if (process.env.REDIS_URL) {
      console.log("Testing with REDIS_URL...")
      redis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 5000,
        lazyConnect: true,
        enableOfflineQueue: false,
      })
    } else if (process.env.REDIS_HOST) {
      console.log("Testing with REDIS_HOST...")
      redis = new Redis({
        host: process.env.REDIS_HOST,
        port: Number.parseInt(process.env.REDIS_PORT || "6379"),
        connectTimeout: 5000,
        lazyConnect: true,
        enableOfflineQueue: false,
      })
    } else {
      console.log("❌ No Redis configuration found")
      return
    }

    redis.on("connect", () => console.log("✅ Connected"))
    redis.on("ready", () => console.log("✅ Ready"))
    redis.on("error", (err) => console.log("❌ Error:", err.message))
    redis.on("close", () => console.log("⚠️ Connection closed"))
    redis.on("end", () => console.log("🔚 Connection ended"))

    await redis.connect()
    const result = await redis.ping()
    console.log("🏓 Ping result:", result)

    await redis.disconnect()
    console.log("✅ Test completed successfully")
  } catch (error) {
    console.log("❌ Test failed:", error.message)
  }
}

testRedis()
