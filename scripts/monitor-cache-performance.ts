import dotenv from "dotenv"
import Redis from "ioredis"

dotenv.config({ path: ".env.local" })

interface PerformanceSnapshot {
  timestamp: Date
  redis: {
    connected: boolean
    hitRate: number
    keyCount: number
    memoryUsage: string
    evictedKeys: number
    expiredKeys: number
    error?: string
  }
  supabase: {
    connected: boolean
    queryTime: number
    recordCount: number
    error?: string
  }
  application: {
    cacheHitRate: number
    avgResponseTime: number
    totalRequests: number
  }
}

class CachePerformanceMonitor {
  private redis: Redis | null = null
  private supabase: any = null
  private snapshots: PerformanceSnapshot[] = []
  private monitoring = false
  private redisConnected = false
  private supabaseConnected = false

  constructor() {
    // Don't initialize in constructor
  }

  async initialize(): Promise<void> {
    console.log("🔧 Initializing monitoring connections...")

    // Initialize Redis with better error handling
    await this.initializeRedis()

    // Initialize Supabase
    await this.initializeSupabase()

    console.log(`Redis: ${this.redisConnected ? "✅ Connected" : "❌ Disconnected"}`)
    console.log(`Supabase: ${this.supabaseConnected ? "✅ Connected" : "❌ Disconnected"}`)

    if (!this.redisConnected && !this.supabaseConnected) {
      throw new Error("Neither Redis nor Supabase connections available")
    }
  }

  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL

    if (!redisUrl) {
      console.log("⚠️ REDIS_URL not configured - Redis monitoring disabled")
      return
    }

    try {
      const isUpstash = redisUrl.includes("upstash.io")

      this.redis = new Redis(redisUrl, {
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        ...(isUpstash && {
          tls: {
            rejectUnauthorized: false,
          },
          family: 4,
        }),
      })

      // Set up event handlers
      this.redis.on("connect", () => {
        console.log("🔗 Redis monitoring connection established")
        this.redisConnected = true
      })

      this.redis.on("ready", () => {
        console.log("✅ Redis monitoring ready")
        this.redisConnected = true
      })

      this.redis.on("error", (error) => {
        console.warn("⚠️ Redis monitoring error:", error.message)
        this.redisConnected = false
      })

      this.redis.on("close", () => {
        console.log("⚠️ Redis monitoring connection closed")
        this.redisConnected = false
      })

      this.redis.on("end", () => {
        console.log("🔚 Redis monitoring connection ended")
        this.redisConnected = false
        this.redis = null
      })

      // Test connection
      await this.redis.connect()
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const result = await this.redis.ping()
      if (result === "PONG") {
        this.redisConnected = true
        console.log("✅ Redis monitoring connection successful")
      } else {
        throw new Error("Invalid ping response")
      }
    } catch (error) {
      console.warn("❌ Redis monitoring initialization failed:", error.message)
      this.redisConnected = false
      if (this.redis) {
        try {
          this.redis.disconnect()
        } catch (e) {
          // Ignore disconnect errors
        }
        this.redis = null
      }
    }
  }

  private async initializeSupabase(): Promise<void> {
    const supabaseUrl = null
    const supabaseKey = null

    if (!supabaseUrl || !supabaseKey) {
      console.log("⚠️ Supabase credentials not configured - Supabase monitoring disabled")
      return
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
        },
        db: {
          schema: "public",
        },
        global: {
          fetch: (url, options = {}) => {
            return fetch(url, {
              ...options,
              signal: AbortSignal.timeout(15000),
            })
          },
        },
      })

      // Test connection
      const { data, error } = await this.supabase
        .from("properties_cache")
        .select("count", { count: "exact", head: true })

      if (error) {
        throw new Error(`Supabase test failed: ${error.message}`)
      }

      this.supabaseConnected = true
      console.log("✅ Supabase monitoring connection successful")
    } catch (error) {
      console.warn("❌ Supabase monitoring initialization failed:", error.message)
      this.supabaseConnected = false
      this.supabase = null
    }
  }

  async takeSnapshot(): Promise<PerformanceSnapshot> {
    const timestamp = new Date()
    const snapshot: PerformanceSnapshot = {
      timestamp,
      redis: {
        connected: this.redisConnected,
        hitRate: 0,
        keyCount: 0,
        memoryUsage: "0B",
        evictedKeys: 0,
        expiredKeys: 0,
      },
      supabase: {
        connected: this.supabaseConnected,
        queryTime: 0,
        recordCount: 0,
      },
      application: {
        cacheHitRate: 0,
        avgResponseTime: 0,
        totalRequests: 0,
      },
    }

    // Redis metrics (only if connected)
    if (this.redis && this.redisConnected) {
      try {
        const info = await this.redis.info()
        const infoLines = info.split("\r\n")

        const keyspaceHits = Number.parseInt(
          infoLines.find((line) => line.startsWith("keyspace_hits:"))?.split(":")[1] || "0",
        )
        const keyspaceMisses = Number.parseInt(
          infoLines.find((line) => line.startsWith("keyspace_misses:"))?.split(":")[1] || "0",
        )
        const totalRequests = keyspaceHits + keyspaceMisses

        snapshot.redis = {
          connected: true,
          hitRate: totalRequests > 0 ? (keyspaceHits / totalRequests) * 100 : 0,
          keyCount: await this.redis.dbsize(),
          memoryUsage: infoLines.find((line) => line.startsWith("used_memory_human:"))?.split(":")[1] || "0B",
          evictedKeys: Number.parseInt(
            infoLines.find((line) => line.startsWith("evicted_keys:"))?.split(":")[1] || "0",
          ),
          expiredKeys: Number.parseInt(
            infoLines.find((line) => line.startsWith("expired_keys:"))?.split(":")[1] || "0",
          ),
        }
      } catch (error) {
        snapshot.redis.connected = false
        snapshot.redis.error = error.message
        this.redisConnected = false
        console.warn("Redis metrics collection failed:", error.message)
      }
    } else {
      snapshot.redis.connected = false
      snapshot.redis.error = "Not connected"
    }

    // Supabase metrics (only if connected)
    if (this.supabase && this.supabaseConnected) {
      try {
        const start = Date.now()
        const { count, error } = await this.supabase
          .from("properties_cache")
          .select("*", { count: "exact", head: true })

        if (error) {
          throw new Error(error.message)
        }

        snapshot.supabase = {
          connected: true,
          queryTime: Date.now() - start,
          recordCount: count || 0,
        }
      } catch (error) {
        snapshot.supabase.connected = false
        snapshot.supabase.error = error.message
        this.supabaseConnected = false
        console.warn("Supabase metrics collection failed:", error.message)
      }
    } else {
      snapshot.supabase.connected = false
      snapshot.supabase.error = "Not connected"
    }

    // Application metrics (try to get from cache service)
    try {
      const { enhancedHybridCacheService } = await import("../lib/enhanced-hybrid-cache-service")
      const stats = enhancedHybridCacheService.getEnhancedStats()

      snapshot.application = {
        cacheHitRate: stats.hitRates.overall,
        avgResponseTime: stats.performance.avgResponseTime,
        totalRequests: stats.performance.totalRequests,
      }
    } catch (error) {
      // Cache service not available - use defaults
    }

    this.snapshots.push(snapshot)

    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100)
    }

    return snapshot
  }

  async startMonitoring(intervalSeconds = 30): Promise<void> {
    if (this.monitoring) {
      console.log("⚠️ Monitoring already running")
      return
    }

    this.monitoring = true
    console.log(`🔍 Starting cache performance monitoring (${intervalSeconds}s intervals)`)
    console.log("Press Ctrl+C to stop monitoring")

    const interval = setInterval(async () => {
      if (!this.monitoring) {
        clearInterval(interval)
        return
      }

      try {
        const snapshot = await this.takeSnapshot()
        this.displaySnapshot(snapshot)
      } catch (error) {
        console.error("❌ Monitoring error:", error.message)
      }
    }, intervalSeconds * 1000)

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Stopping monitoring...")
      this.monitoring = false
      clearInterval(interval)
      this.generateReport()
      process.exit(0)
    })

    // Take initial snapshot
    try {
      const snapshot = await this.takeSnapshot()
      this.displaySnapshot(snapshot)
    } catch (error) {
      console.error("❌ Initial snapshot failed:", error.message)
    }
  }

  private displaySnapshot(snapshot: PerformanceSnapshot): void {
    console.clear()
    console.log("🔍 CACHE PERFORMANCE MONITOR")
    console.log("=".repeat(50))
    console.log(`📅 ${snapshot.timestamp.toLocaleString()}`)
    console.log()

    console.log("🔴 REDIS METRICS:")
    if (snapshot.redis.connected) {
      console.log(`   Status: ✅ Connected`)
      console.log(`   Hit Rate: ${snapshot.redis.hitRate.toFixed(2)}%`)
      console.log(`   Keys: ${snapshot.redis.keyCount}`)
      console.log(`   Memory: ${snapshot.redis.memoryUsage}`)
      console.log(`   Evicted: ${snapshot.redis.evictedKeys}`)
      console.log(`   Expired: ${snapshot.redis.expiredKeys}`)
    } else {
      console.log(`   Status: ❌ Disconnected`)
      console.log(`   Error: ${snapshot.redis.error || "Unknown"}`)
    }

    console.log("\n💾 SUPABASE METRICS:")
    if (snapshot.supabase.connected) {
      console.log(`   Status: ✅ Connected`)
      console.log(`   Query Time: ${snapshot.supabase.queryTime}ms`)
      console.log(`   Records: ${snapshot.supabase.recordCount}`)
    } else {
      console.log(`   Status: ❌ Disconnected`)
      console.log(`   Error: ${snapshot.supabase.error || "Unknown"}`)
    }

    console.log("\n🚀 APPLICATION METRICS:")
    console.log(`   Cache Hit Rate: ${snapshot.application.cacheHitRate.toFixed(2)}%`)
    console.log(`   Avg Response: ${snapshot.application.avgResponseTime.toFixed(2)}ms`)
    console.log(`   Total Requests: ${snapshot.application.totalRequests}`)

    // Show trend if we have multiple snapshots
    if (this.snapshots.length > 1) {
      const previous = this.snapshots[this.snapshots.length - 2]
      const current = snapshot

      console.log("\n📈 TRENDS:")
      if (current.redis.connected && previous.redis.connected) {
        const hitRateTrend = current.redis.hitRate - previous.redis.hitRate
        console.log(`   Redis Hit Rate: ${hitRateTrend >= 0 ? "+" : ""}${hitRateTrend.toFixed(2)}%`)
      }

      const responseTrend = current.application.avgResponseTime - previous.application.avgResponseTime
      console.log(`   Response Time: ${responseTrend >= 0 ? "+" : ""}${responseTrend.toFixed(2)}ms`)
    }

    console.log("\n🔧 CONNECTION STATUS:")
    console.log(`   Redis: ${snapshot.redis.connected ? "🟢 Online" : "🔴 Offline"}`)
    console.log(`   Supabase: ${snapshot.supabase.connected ? "🟢 Online" : "🔴 Offline"}`)

    console.log("\n" + "=".repeat(50))
    console.log("Press Ctrl+C to stop and generate report")
  }

  generateReport(): void {
    if (this.snapshots.length === 0) {
      console.log("❌ No data collected for report")
      return
    }

    console.log("\n📊 PERFORMANCE MONITORING REPORT")
    console.log("=".repeat(50))

    const first = this.snapshots[0]
    const last = this.snapshots[this.snapshots.length - 1]
    const duration = (last.timestamp.getTime() - first.timestamp.getTime()) / 1000 / 60 // minutes

    console.log(`📅 Duration: ${duration.toFixed(1)} minutes`)
    console.log(`📊 Snapshots: ${this.snapshots.length}`)

    // Connection stability
    const redisUptime = this.snapshots.filter((s) => s.redis.connected).length / this.snapshots.length
    const supabaseUptime = this.snapshots.filter((s) => s.supabase.connected).length / this.snapshots.length

    console.log("\n🔗 CONNECTION STABILITY:")
    console.log(`   Redis Uptime: ${(redisUptime * 100).toFixed(1)}%`)
    console.log(`   Supabase Uptime: ${(supabaseUptime * 100).toFixed(1)}%`)

    // Calculate averages (only for connected snapshots)
    const connectedRedisSnapshots = this.snapshots.filter((s) => s.redis.connected)
    const connectedSupabaseSnapshots = this.snapshots.filter((s) => s.supabase.connected)

    if (connectedRedisSnapshots.length > 0) {
      const avgRedisHitRate =
        connectedRedisSnapshots.reduce((sum, s) => sum + s.redis.hitRate, 0) / connectedRedisSnapshots.length

      console.log("\n📈 REDIS AVERAGES:")
      console.log(`   Hit Rate: ${avgRedisHitRate.toFixed(2)}%`)
      console.log(
        `   Keys: ${Math.round(
          connectedRedisSnapshots.reduce((sum, s) => sum + s.redis.keyCount, 0) / connectedRedisSnapshots.length,
        )}`,
      )
    }

    if (connectedSupabaseSnapshots.length > 0) {
      const avgQueryTime =
        connectedSupabaseSnapshots.reduce((sum, s) => sum + s.supabase.queryTime, 0) / connectedSupabaseSnapshots.length

      console.log("\n📈 SUPABASE AVERAGES:")
      console.log(`   Query Time: ${avgQueryTime.toFixed(2)}ms`)
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS:")
    if (redisUptime < 0.9) {
      console.log("   • Redis connection unstable - check network/credentials")
    }
    if (supabaseUptime < 0.9) {
      console.log("   • Supabase connection unstable - check credentials")
    }
    if (connectedRedisSnapshots.length === 0) {
      console.log("   • Redis never connected - run connection diagnostic")
    }

    console.log("\n🔧 NEXT STEPS:")
    console.log("   1. Run: npx tsx scripts/check-connections.ts")
    console.log("   2. Fix connection issues")
    console.log("   3. Run: npx tsx scripts/warm-redis-cache.ts")
  }

  async cleanup(): Promise<void> {
    this.monitoring = false
    if (this.redis) {
      try {
        await this.redis.quit()
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// CLI interface
async function main() {
  const monitor = new CachePerformanceMonitor()

  try {
    const args = process.argv.slice(2)
    const interval = Number.parseInt(args.find((arg) => arg.startsWith("--interval="))?.split("=")[1] || "30")
    const oneShot = args.includes("--once")

    console.log("🔍 Cache Performance Monitor")
    console.log("=".repeat(40))

    // Initialize with better error handling
    try {
      await monitor.initialize()
    } catch (error) {
      console.log("⚠️ Initialization warning:", error.message)
      console.log("Continuing with available connections...")
    }

    if (oneShot) {
      console.log("📸 Taking single performance snapshot...")
      const snapshot = await monitor.takeSnapshot()
      monitor.displaySnapshot(snapshot)
    } else {
      await monitor.startMonitoring(interval)
    }
  } catch (error) {
    console.error("❌ Monitoring failed:", error.message)
    console.log("\n🔧 Try running the connection diagnostic first:")
    console.log("npx tsx scripts/check-connections.ts")
    process.exit(1)
  } finally {
    await monitor.cleanup()
  }
}

if (require.main === module) {
  main()
}

export { CachePerformanceMonitor }
