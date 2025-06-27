#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

async function testRedisConnection() {
  console.log("🔍 TESTING REDIS CONNECTION")
  console.log("=".repeat(40))

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    console.log("❌ REDIS_URL not found in environment variables")
    console.log("ℹ️ Add REDIS_URL to your .env.local file")
    return
  }

  console.log("🔗 Redis URL found:", redisUrl.replace(/:[^:@]*@/, ":***@"))

  try {
    const Redis = (await import("ioredis")).default

    // Test with different connection strategies
    const strategies = [
      {
        name: "Basic Connection",
        config: {
          connectTimeout: 10000,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        },
      },
      {
        name: "Upstash Optimized",
        config: {
          connectTimeout: 10000,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableOfflineQueue: false,
          tls: {},
          keepAlive: 30000,
          family: 4,
        },
      },
    ]

    for (const strategy of strategies) {
      console.log(`\n🧪 Testing ${strategy.name}...`)

      const redis = new Redis(redisUrl, strategy.config)

      try {
        await redis.connect()
        const pingResult = await redis.ping()

        if (pingResult === "PONG") {
          console.log(`✅ ${strategy.name}: Connection successful`)

          // Test basic operations
          await redis.set("test-key", "test-value", "EX", 10)
          const value = await redis.get("test-key")

          if (value === "test-value") {
            console.log(`✅ ${strategy.name}: Read/Write operations successful`)
            await redis.del("test-key")
          } else {
            console.log(`⚠️ ${strategy.name}: Read/Write operations failed`)
          }
        } else {
          console.log(`❌ ${strategy.name}: Invalid ping response: ${pingResult}`)
        }

        await redis.quit()
        break // If successful, no need to try other strategies
      } catch (error) {
        console.log(`❌ ${strategy.name}: ${error.message}`)
        try {
          await redis.disconnect()
        } catch (disconnectError) {
          // Ignore disconnect errors
        }
      }
    }
  } catch (error) {
    console.error("❌ Redis testing failed:", error.message)
  }
}

testRedisConnection().catch(console.error)
