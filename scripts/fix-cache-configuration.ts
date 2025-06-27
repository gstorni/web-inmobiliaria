import dotenv from "dotenv"
import Redis from "ioredis"

dotenv.config({ path: ".env.local" })

class CacheConfigurationFixer {
  private redis: Redis | null = null
  private supabase: any = null

  constructor() {
    this.initializeClients()
  }

  private async initializeClients() {
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        connectTimeout: 10000,
        lazyConnect: true,
        tls: redisUrl.includes("upstash.io") ? {} : undefined,
      })
      await this.redis.connect()
      console.log("✅ Redis connected")
    }

    const supabaseUrl = null
    const supabaseKey = null
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey)
      console.log("✅ Supabase connected")
    }
  }

  async fixRedisConfiguration(): Promise<void> {
    if (!this.redis) {
      console.log("❌ Redis not available")
      return
    }

    console.log("🔧 Fixing Redis configuration...")

    try {
      // Check if we can set configuration (not available on Upstash)
      const redisUrl = process.env.REDIS_URL
      const isUpstash = redisUrl?.includes("upstash.io")

      if (!isUpstash) {
        // Set optimal eviction policy
        await this.redis.config("SET", "maxmemory-policy", "allkeys-lru")
        console.log("✅ Set eviction policy to allkeys-lru")

        // Set reasonable memory limit (256MB)
        await this.redis.config("SET", "maxmemory", "268435456")
        console.log("✅ Set max memory to 256MB")

        // Optimize for performance
        await this.redis.config("SET", "save", "")
        console.log("✅ Disabled RDB snapshots for performance")
      } else {
        console.log("ℹ️ Upstash Redis - configuration is managed by provider")
      }

      // Clear any corrupted keys
      const corruptedKeys = await this.redis.keys("*corrupted*")
      if (corruptedKeys.length > 0) {
        await this.redis.del(...corruptedKeys)
        console.log(`🗑️ Removed ${corruptedKeys.length} corrupted keys`)
      }

      // Reset access tracking
      await this.redis.del("property_access")
      await this.redis.zadd("property_access", Date.now(), "initialized")
      console.log("✅ Reset access tracking")

      console.log("🎉 Redis configuration fixed!")
    } catch (error) {
      console.error("❌ Failed to fix Redis configuration:", error.message)
    }
  }

  async optimizeCacheKeys(): Promise<void> {
    if (!this.redis) return

    console.log("🔑 Optimizing cache keys...")

    try {
      // Get all keys
      const allKeys = await this.redis.keys("*")
      console.log(`📊 Found ${allKeys.length} keys`)

      // Find and fix inconsistent property keys
      const propertyKeys = allKeys.filter((key) => key.startsWith("property:"))
      const inconsistentKeys = propertyKeys.filter((key) => !/^property:\d+$/.test(key))

      if (inconsistentKeys.length > 0) {
        console.log(`🔧 Fixing ${inconsistentKeys.length} inconsistent keys`)
        for (const key of inconsistentKeys) {
          // Try to extract property ID and rename
          const match = key.match(/property[:\-_](\d+)/)
          if (match) {
            const propertyId = match[1]
            const correctKey = `property:${propertyId}`
            const value = await this.redis.get(key)
            if (value) {
              await this.redis.setex(correctKey, 7200, value)
              await this.redis.del(key)
              console.log(`✅ Renamed ${key} → ${correctKey}`)
            }
          }
        }
      }

      // Clean up expired search keys
      const searchKeys = allKeys.filter((key) => key.startsWith("search:"))
      let cleanedSearches = 0

      for (const key of searchKeys) {
        const ttl = await this.redis.ttl(key)
        if (ttl === -2) {
          // Key expired but not cleaned up
          await this.redis.del(key)
          cleanedSearches++
        }
      }

      if (cleanedSearches > 0) {
        console.log(`🗑️ Cleaned up ${cleanedSearches} expired search keys`)
      }

      console.log("✅ Cache key optimization completed")
    } catch (error) {
      console.error("❌ Key optimization failed:", error.message)
    }
  }

  async validateCacheData(): Promise<void> {
    if (!this.redis) return

    console.log("🔍 Validating cache data integrity...")

    try {
      const propertyKeys = await this.redis.keys("property:*")
      let validKeys = 0
      let invalidKeys = 0
      const invalidKeysList: string[] = []

      for (const key of propertyKeys.slice(0, 20)) {
        // Sample first 20 keys
        try {
          const data = await this.redis.get(key)
          if (data) {
            const parsed = JSON.parse(data)
            if (parsed.id && parsed.title) {
              validKeys++
            } else {
              invalidKeys++
              invalidKeysList.push(key)
            }
          } else {
            invalidKeys++
            invalidKeysList.push(key)
          }
        } catch (error) {
          invalidKeys++
          invalidKeysList.push(key)
        }
      }

      console.log(`✅ Valid keys: ${validKeys}`)
      console.log(`❌ Invalid keys: ${invalidKeys}`)

      // Remove invalid keys
      if (invalidKeysList.length > 0) {
        await this.redis.del(...invalidKeysList)
        console.log(`🗑️ Removed ${invalidKeysList.length} invalid keys`)
      }

      console.log("✅ Data validation completed")
    } catch (error) {
      console.error("❌ Data validation failed:", error.message)
    }
  }

  async repairCacheService(): Promise<void> {
    console.log("🔧 Repairing cache service configuration...")

    try {
      // Try to reinitialize the cache service
      const { enhancedHybridCacheService } = await import("../lib/enhanced-hybrid-cache-service")

      // Force a stats refresh to reinitialize
      const stats = enhancedHybridCacheService.getEnhancedStats()
      console.log("✅ Cache service is responsive")
      console.log(`📊 Current stats: ${stats.hitRates.redis.toFixed(2)}% Redis hit rate`)

      // Test cache operations
      const testKey = "test:repair"
      const testData = { test: true, timestamp: Date.now() }

      // Test write
      if (this.redis) {
        await this.redis.setex(testKey, 60, JSON.stringify(testData))
        console.log("✅ Cache write test passed")

        // Test read
        const retrieved = await this.redis.get(testKey)
        if (retrieved) {
          const parsed = JSON.parse(retrieved)
          if (parsed.test === true) {
            console.log("✅ Cache read test passed")
          } else {
            console.log("❌ Cache read test failed - data corruption")
          }
        } else {
          console.log("❌ Cache read test failed - no data retrieved")
        }

        // Clean up test key
        await this.redis.del(testKey)
      }

      console.log("✅ Cache service repair completed")
    } catch (error) {
      console.error("❌ Cache service repair failed:", error.message)
      console.log("💡 Try restarting the application after running this script")
    }
  }

  async runFullRepair(): Promise<void> {
    console.log("🚀 Starting full cache configuration repair...")
    console.log("=".repeat(50))

    await this.fixRedisConfiguration()
    await this.optimizeCacheKeys()
    await this.validateCacheData()
    await this.repairCacheService()

    console.log("\n🎉 Full cache repair completed!")
    console.log("\n🔧 NEXT STEPS:")
    console.log("1. Run cache warming: npx tsx scripts/warm-redis-cache.ts")
    console.log("2. Run diagnostic: npx tsx scripts/diagnose-redis-hit-rate.ts")
    console.log("3. Monitor performance: npx tsx scripts/monitor-cache-performance.ts")
    console.log("4. Check dashboard at /enhanced-dashboard")
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// CLI interface
async function main() {
  const fixer = new CacheConfigurationFixer()

  try {
    const args = process.argv.slice(2)

    if (args.includes("--redis-only")) {
      await fixer.fixRedisConfiguration()
    } else if (args.includes("--keys-only")) {
      await fixer.optimizeCacheKeys()
    } else if (args.includes("--validate-only")) {
      await fixer.validateCacheData()
    } else if (args.includes("--service-only")) {
      await fixer.repairCacheService()
    } else {
      await fixer.runFullRepair()
    }
  } catch (error) {
    console.error("❌ Cache configuration repair failed:", error.message)
    process.exit(1)
  } finally {
    await fixer.cleanup()
  }
}

if (require.main === module) {
  main()
}

export { CacheConfigurationFixer }
