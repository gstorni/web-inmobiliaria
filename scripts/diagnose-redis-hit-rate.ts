import dotenv from "dotenv"
import Redis from "ioredis"

// Load environment variables
dotenv.config({ path: ".env.local" })

interface DiagnosticResult {
  section: string
  status: "pass" | "warning" | "fail"
  message: string
  details?: any
  recommendations?: string[]
}

class RedisHitRateDiagnostic {
  private redis: Redis | null = null
  private supabase: any = null
  private results: DiagnosticResult[] = []

  constructor() {
    this.initializeClients()
  }

  private async initializeClients() {
    // Initialize Redis
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          connectTimeout: 5000,
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          tls: redisUrl.includes("upstash.io") ? {} : undefined,
        })
        await this.redis.connect()
        console.log("✅ Redis client initialized")
      } catch (error) {
        console.error("❌ Redis initialization failed:", error.message)
      }
    }

    // Initialize Supabase
    const supabaseUrl = null
    const supabaseKey = null
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey)
      console.log("✅ Supabase client initialized")
    }
  }

  async runFullDiagnostic(): Promise<void> {
    console.log("🔍 Starting Redis Hit Rate Diagnostic...")
    console.log("=".repeat(60))

    await this.checkRedisConnection()
    await this.analyzeRedisDataPopulation()
    await this.analyzeCacheKeyStrategy()
    await this.checkCacheEvictionPolicies()
    await this.analyzeSupabaseActivity()
    await this.checkDashboardConfiguration()
    await this.performCacheEfficiencyTest()

    this.generateReport()
  }

  private async checkRedisConnection(): Promise<void> {
    console.log("\n1️⃣ REDIS CONNECTION ANALYSIS")
    console.log("-".repeat(40))

    if (!this.redis) {
      this.results.push({
        section: "Redis Connection",
        status: "fail",
        message: "Redis client not initialized",
        recommendations: [
          "Check REDIS_URL environment variable",
          "Verify Redis server is running",
          "Test network connectivity to Redis server",
        ],
      })
      return
    }

    try {
      // Test basic connectivity
      const pingResult = await this.redis.ping()
      console.log(`✅ Redis PING: ${pingResult}`)

      // Get Redis info
      const info = await this.redis.info()
      const infoLines = info.split("\r\n")
      const memoryInfo = infoLines.find((line) => line.startsWith("used_memory_human:"))
      const connectedClients = infoLines.find((line) => line.startsWith("connected_clients:"))
      const keyspaceHits = infoLines.find((line) => line.startsWith("keyspace_hits:"))
      const keyspaceMisses = infoLines.find((line) => line.startsWith("keyspace_misses:"))

      console.log(`📊 Memory Usage: ${memoryInfo?.split(":")[1] || "Unknown"}`)
      console.log(`👥 Connected Clients: ${connectedClients?.split(":")[1] || "Unknown"}`)

      // Calculate hit rate from Redis stats
      const hits = Number.parseInt(keyspaceHits?.split(":")[1] || "0")
      const misses = Number.parseInt(keyspaceMisses?.split(":")[1] || "0")
      const totalRequests = hits + misses
      const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0

      console.log(`🎯 Redis Internal Hit Rate: ${hitRate.toFixed(2)}% (${hits} hits, ${misses} misses)`)

      this.results.push({
        section: "Redis Connection",
        status: hitRate > 70 ? "pass" : hitRate > 40 ? "warning" : "fail",
        message: `Redis connected with ${hitRate.toFixed(2)}% internal hit rate`,
        details: { hits, misses, hitRate, memoryUsage: memoryInfo?.split(":")[1] },
        recommendations:
          hitRate < 70
            ? [
                "Low hit rate indicates cache warming issues",
                "Check if data is being written to Redis",
                "Verify cache key consistency",
              ]
            : [],
      })
    } catch (error) {
      console.error("❌ Redis connection test failed:", error.message)
      this.results.push({
        section: "Redis Connection",
        status: "fail",
        message: `Redis connection failed: ${error.message}`,
        recommendations: ["Check Redis server status", "Verify connection credentials", "Test network connectivity"],
      })
    }
  }

  private async analyzeRedisDataPopulation(): Promise<void> {
    console.log("\n2️⃣ REDIS DATA POPULATION ANALYSIS")
    console.log("-".repeat(40))

    if (!this.redis) {
      console.log("❌ Redis not available for data population analysis")
      return
    }

    try {
      // Check total keys in Redis
      const totalKeys = await this.redis.dbsize()
      console.log(`📊 Total Redis Keys: ${totalKeys}`)

      // Check property keys specifically
      const propertyKeys = await this.redis.keys("property:*")
      const searchKeys = await this.redis.keys("search:*")
      const accessKeys = await this.redis.keys("property_access")

      console.log(`🏠 Property Keys: ${propertyKeys.length}`)
      console.log(`🔍 Search Keys: ${searchKeys.length}`)
      console.log(`📈 Access Tracking Keys: ${accessKeys.length}`)

      // Sample some property data
      if (propertyKeys.length > 0) {
        const sampleKey = propertyKeys[0]
        const sampleData = await this.redis.get(sampleKey)
        const ttl = await this.redis.ttl(sampleKey)

        console.log(`📋 Sample Key: ${sampleKey}`)
        console.log(`⏰ TTL: ${ttl} seconds (${ttl > 0 ? (ttl / 3600).toFixed(1) + " hours" : "no expiry"})`)
        console.log(`📦 Data Size: ${sampleData ? (sampleData.length / 1024).toFixed(2) + " KB" : "No data"}`)

        // Validate JSON structure
        try {
          const parsed = JSON.parse(sampleData || "{}")
          console.log(`✅ Data Structure Valid: ${Object.keys(parsed).length} properties`)
        } catch {
          console.log("❌ Invalid JSON structure in cached data")
        }
      }

      // Check for cache warming patterns
      const warmingKeys = await this.redis.keys("warming:*")
      console.log(`🔥 Cache Warming Keys: ${warmingKeys.length}`)

      this.results.push({
        section: "Data Population",
        status: propertyKeys.length > 10 ? "pass" : propertyKeys.length > 0 ? "warning" : "fail",
        message: `${propertyKeys.length} properties cached in Redis`,
        details: {
          totalKeys,
          propertyKeys: propertyKeys.length,
          searchKeys: searchKeys.length,
          warmingKeys: warmingKeys.length,
        },
        recommendations:
          propertyKeys.length < 50
            ? [
                "Low number of cached properties",
                "Run cache warming process",
                "Check if properties are being written to Redis",
                "Verify cache population logic",
              ]
            : [],
      })
    } catch (error) {
      console.error("❌ Data population analysis failed:", error.message)
      this.results.push({
        section: "Data Population",
        status: "fail",
        message: `Data population analysis failed: ${error.message}`,
      })
    }
  }

  private async analyzeCacheKeyStrategy(): Promise<void> {
    console.log("\n3️⃣ CACHE KEY STRATEGY ANALYSIS")
    console.log("-".repeat(40))

    if (!this.redis) {
      console.log("❌ Redis not available for key strategy analysis")
      return
    }

    try {
      // Analyze key patterns
      const allKeys = await this.redis.keys("*")
      const keyPatterns = new Map<string, number>()

      allKeys.forEach((key) => {
        const pattern = key.split(":")[0]
        keyPatterns.set(pattern, (keyPatterns.get(pattern) || 0) + 1)
      })

      console.log("🔑 Key Patterns:")
      keyPatterns.forEach((count, pattern) => {
        console.log(`   ${pattern}: ${count} keys`)
      })

      // Check for potential key collisions
      const duplicateCheck = new Set()
      const collisions: string[] = []

      for (const key of allKeys) {
        if (duplicateCheck.has(key)) {
          collisions.push(key)
        }
        duplicateCheck.add(key)
      }

      console.log(`🔍 Key Collisions: ${collisions.length}`)
      if (collisions.length > 0) {
        console.log("   Colliding keys:", collisions.slice(0, 5))
      }

      // Analyze key naming efficiency
      const avgKeyLength = allKeys.reduce((sum, key) => sum + key.length, 0) / allKeys.length
      console.log(`📏 Average Key Length: ${avgKeyLength.toFixed(1)} characters`)

      // Check for consistent key patterns
      const propertyKeys = allKeys.filter((key) => key.startsWith("property:"))
      const inconsistentKeys = propertyKeys.filter((key) => !/^property:\d+$/.test(key))

      console.log(`⚠️ Inconsistent Property Keys: ${inconsistentKeys.length}`)
      if (inconsistentKeys.length > 0) {
        console.log("   Examples:", inconsistentKeys.slice(0, 3))
      }

      this.results.push({
        section: "Cache Key Strategy",
        status: collisions.length === 0 && inconsistentKeys.length < 5 ? "pass" : "warning",
        message: `Key strategy analysis: ${keyPatterns.size} patterns, ${collisions.length} collisions`,
        details: {
          totalKeys: allKeys.length,
          patterns: Object.fromEntries(keyPatterns),
          collisions: collisions.length,
          avgKeyLength,
          inconsistentKeys: inconsistentKeys.length,
        },
        recommendations:
          collisions.length > 0 || inconsistentKeys.length > 5
            ? [
                "Standardize key naming patterns",
                "Implement key validation",
                "Review cache key generation logic",
                "Consider key prefixing strategy",
              ]
            : [],
      })
    } catch (error) {
      console.error("❌ Key strategy analysis failed:", error.message)
    }
  }

  private async checkCacheEvictionPolicies(): Promise<void> {
    console.log("\n4️⃣ CACHE EVICTION POLICY ANALYSIS")
    console.log("-".repeat(40))

    if (!this.redis) {
      console.log("❌ Redis not available for eviction policy analysis")
      return
    }

    try {
      // Get Redis configuration
      const maxMemory = await this.redis.config("GET", "maxmemory")
      const evictionPolicy = await this.redis.config("GET", "maxmemory-policy")

      console.log(`💾 Max Memory: ${maxMemory[1] || "unlimited"}`)
      console.log(`🔄 Eviction Policy: ${evictionPolicy[1] || "noeviction"}`)

      // Get memory usage info
      const info = await this.redis.info("memory")
      const memoryLines = info.split("\r\n")
      const usedMemory = memoryLines.find((line) => line.startsWith("used_memory:"))
      const usedMemoryHuman = memoryLines.find((line) => line.startsWith("used_memory_human:"))
      const memoryFragmentation = memoryLines.find((line) => line.startsWith("mem_fragmentation_ratio:"))

      console.log(`📊 Used Memory: ${usedMemoryHuman?.split(":")[1] || "Unknown"}`)
      console.log(`🔧 Fragmentation Ratio: ${memoryFragmentation?.split(":")[1] || "Unknown"}`)

      // Check eviction stats
      const evictedKeys = memoryLines.find((line) => line.startsWith("evicted_keys:"))
      const expiredKeys = memoryLines.find((line) => line.startsWith("expired_keys:"))

      console.log(`🗑️ Evicted Keys: ${evictedKeys?.split(":")[1] || "0"}`)
      console.log(`⏰ Expired Keys: ${expiredKeys?.split(":")[1] || "0"}`)

      // Analyze TTL distribution
      const propertyKeys = await this.redis.keys("property:*")
      const ttlAnalysis = { noExpiry: 0, shortTerm: 0, mediumTerm: 0, longTerm: 0 }

      for (const key of propertyKeys.slice(0, 20)) {
        // Sample first 20 keys
        const ttl = await this.redis.ttl(key)
        if (ttl === -1) ttlAnalysis.noExpiry++
        else if (ttl < 3600)
          ttlAnalysis.shortTerm++ // < 1 hour
        else if (ttl < 86400)
          ttlAnalysis.mediumTerm++ // < 1 day
        else ttlAnalysis.longTerm++ // >= 1 day
      }

      console.log("⏰ TTL Distribution (sample):")
      console.log(`   No Expiry: ${ttlAnalysis.noExpiry}`)
      console.log(`   Short Term (<1h): ${ttlAnalysis.shortTerm}`)
      console.log(`   Medium Term (<1d): ${ttlAnalysis.mediumTerm}`)
      console.log(`   Long Term (>=1d): ${ttlAnalysis.longTerm}`)

      const evictedCount = Number.parseInt(evictedKeys?.split(":")[1] || "0")
      const policy = evictionPolicy[1] || "noeviction"

      this.results.push({
        section: "Eviction Policy",
        status: evictedCount < 100 && policy !== "noeviction" ? "pass" : "warning",
        message: `Eviction policy: ${policy}, ${evictedCount} keys evicted`,
        details: {
          maxMemory: maxMemory[1],
          evictionPolicy: policy,
          evictedKeys: evictedCount,
          ttlDistribution: ttlAnalysis,
        },
        recommendations:
          evictedCount > 100 || policy === "noeviction"
            ? [
                "High eviction rate may indicate insufficient memory",
                "Consider increasing Redis memory limit",
                "Review TTL settings for cached data",
                "Implement LRU eviction policy if not set",
              ]
            : [],
      })
    } catch (error) {
      console.error("❌ Eviction policy analysis failed:", error.message)
    }
  }

  private async analyzeSupabaseActivity(): Promise<void> {
    console.log("\n5️⃣ SUPABASE ACTIVITY ANALYSIS")
    console.log("-".repeat(40))

    if (!this.supabase) {
      console.log("❌ Supabase not available for activity analysis")
      return
    }

    try {
      // Check properties cache table
      const { data: propertiesCount, error: countError } = await this.supabase
        .from("properties_cache")
        .select("*", { count: "exact", head: true })

      if (countError) {
        console.log("❌ Error counting properties:", countError.message)
      } else {
        console.log(`🏠 Properties in Supabase: ${propertiesCount?.length || 0}`)
      }

      // Check recent activity
      const { data: recentProperties, error: recentError } = await this.supabase
        .from("properties_cache")
        .select("tokko_id, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(5)

      if (recentError) {
        console.log("❌ Error fetching recent properties:", recentError.message)
      } else {
        console.log("📅 Recent Properties:")
        recentProperties?.forEach((prop, index) => {
          console.log(`   ${index + 1}. ID: ${prop.tokko_id}, Updated: ${prop.updated_at}`)
        })
      }

      // Check for performance metrics table
      const { data: metricsCount, error: metricsError } = await this.supabase
        .from("cache_performance_metrics")
        .select("*", { count: "exact", head: true })

      if (metricsError) {
        console.log("❌ Performance metrics table not found:", metricsError.message)
      } else {
        console.log(`📊 Performance Metrics Records: ${metricsCount?.length || 0}`)
      }

      // Test query performance
      const queryStart = Date.now()
      const { data: testQuery, error: testError } = await this.supabase
        .from("properties_cache")
        .select("tokko_id")
        .limit(10)

      const queryTime = Date.now() - queryStart

      if (testError) {
        console.log("❌ Test query failed:", testError.message)
      } else {
        console.log(`⚡ Supabase Query Time: ${queryTime}ms for ${testQuery?.length || 0} records`)
      }

      this.results.push({
        section: "Supabase Activity",
        status: !countError && !recentError ? "pass" : "warning",
        message: `Supabase analysis: ${propertiesCount?.length || 0} properties, ${queryTime}ms query time`,
        details: {
          propertiesCount: propertiesCount?.length || 0,
          queryTime,
          hasMetricsTable: !metricsError,
          recentActivity: recentProperties?.length || 0,
        },
        recommendations:
          queryTime > 100
            ? [
                "Slow Supabase queries may indicate missing indexes",
                "Consider adding database indexes for frequently queried columns",
                "Review query optimization",
              ]
            : [],
      })
    } catch (error) {
      console.error("❌ Supabase activity analysis failed:", error.message)
    }
  }

  private async checkDashboardConfiguration(): Promise<void> {
    console.log("\n6️⃣ DASHBOARD CONFIGURATION ANALYSIS")
    console.log("-".repeat(40))

    try {
      // Check if enhanced cache service is available
      let cacheServiceAvailable = false
      let cacheStats: any = null

      try {
        // Try to import and get stats from the enhanced cache service
        const { enhancedHybridCacheService } = await import("../lib/enhanced-hybrid-cache-service")
        cacheStats = enhancedHybridCacheService.getEnhancedStats()
        cacheServiceAvailable = true
        console.log("✅ Enhanced cache service available")
      } catch (error) {
        console.log("❌ Enhanced cache service not available:", error.message)
      }

      if (cacheStats) {
        console.log("📊 Cache Service Stats:")
        console.log(`   Redis Hit Rate: ${cacheStats.hitRates.redis.toFixed(2)}%`)
        console.log(`   PostgreSQL Hit Rate: ${cacheStats.hitRates.postgres.toFixed(2)}%`)
        console.log(`   Overall Hit Rate: ${cacheStats.hitRates.overall.toFixed(2)}%`)
        console.log(`   Total Requests: ${cacheStats.performance.totalRequests}`)
        console.log(`   Avg Response Time: ${cacheStats.performance.avgResponseTime.toFixed(2)}ms`)
        console.log(`   Redis Size: ${cacheStats.capacity.redisSize}/${cacheStats.capacity.redisCapacity}`)
      }

      // Check API endpoints
      const apiEndpoints = [
        "/api/cache/enhanced-stats",
        "/api/cache/predictive-warm",
        "/api/system/health",
        "/api/properties/search",
      ]

      console.log("🔗 API Endpoint Status:")
      for (const endpoint of apiEndpoints) {
        try {
          const response = await fetch(`http://localhost:3000${endpoint}`, {
            method: endpoint.includes("warm") ? "POST" : "GET",
          })
          console.log(`   ${endpoint}: ${response.status === 200 ? "✅" : "❌"} (${response.status})`)
        } catch (error) {
          console.log(`   ${endpoint}: ❌ (Connection failed)`)
        }
      }

      this.results.push({
        section: "Dashboard Configuration",
        status: cacheServiceAvailable ? "pass" : "fail",
        message: `Dashboard configuration: ${cacheServiceAvailable ? "Available" : "Not available"}`,
        details: {
          cacheServiceAvailable,
          stats: cacheStats
            ? {
                redisHitRate: cacheStats.hitRates.redis,
                overallHitRate: cacheStats.hitRates.overall,
                totalRequests: cacheStats.performance.totalRequests,
              }
            : null,
        },
        recommendations: !cacheServiceAvailable
          ? [
              "Enhanced cache service not properly initialized",
              "Check if all required dependencies are installed",
              "Verify environment variables are set correctly",
              "Restart the application after configuration changes",
            ]
          : [],
      })
    } catch (error) {
      console.error("❌ Dashboard configuration analysis failed:", error.message)
    }
  }

  private async performCacheEfficiencyTest(): Promise<void> {
    console.log("\n7️⃣ CACHE EFFICIENCY TEST")
    console.log("-".repeat(40))

    if (!this.redis || !this.supabase) {
      console.log("❌ Cannot perform efficiency test without Redis and Supabase")
      return
    }

    try {
      // Get a sample property ID from Supabase
      const { data: sampleProperty } = await this.supabase.from("properties_cache").select("tokko_id").limit(1).single()

      if (!sampleProperty) {
        console.log("❌ No properties available for testing")
        return
      }

      const propertyId = sampleProperty.tokko_id
      const cacheKey = `property:${propertyId}`

      console.log(`🧪 Testing with Property ID: ${propertyId}`)

      // Test 1: Cold cache (ensure key doesn't exist)
      await this.redis.del(cacheKey)
      const coldStart = Date.now()
      const coldResult = await this.redis.get(cacheKey)
      const coldTime = Date.now() - coldStart

      console.log(`❄️ Cold Cache Test: ${coldTime}ms (${coldResult ? "HIT" : "MISS"})`)

      // Test 2: Warm the cache
      const { data: propertyData } = await this.supabase
        .from("properties_cache")
        .select("*")
        .eq("tokko_id", propertyId)
        .single()

      if (propertyData) {
        await this.redis.setex(cacheKey, 3600, JSON.stringify(propertyData))
        console.log("🔥 Cache warmed with property data")
      }

      // Test 3: Hot cache
      const hotStart = Date.now()
      const hotResult = await this.redis.get(cacheKey)
      const hotTime = Date.now() - hotStart

      console.log(`🔥 Hot Cache Test: ${hotTime}ms (${hotResult ? "HIT" : "MISS"})`)

      // Test 4: Multiple rapid requests
      const rapidTests = []
      for (let i = 0; i < 10; i++) {
        const start = Date.now()
        await this.redis.get(cacheKey)
        rapidTests.push(Date.now() - start)
      }

      const avgRapidTime = rapidTests.reduce((a, b) => a + b, 0) / rapidTests.length
      console.log(`⚡ Rapid Access Test: ${avgRapidTime.toFixed(2)}ms average (10 requests)`)

      // Test 5: Cache vs Database comparison
      const dbStart = Date.now()
      await this.supabase.from("properties_cache").select("*").eq("tokko_id", propertyId).single()
      const dbTime = Date.now() - dbStart

      console.log(`💾 Database Direct: ${dbTime}ms`)
      console.log(`📊 Cache Speedup: ${(dbTime / hotTime).toFixed(1)}x faster`)

      this.results.push({
        section: "Cache Efficiency",
        status: hotTime < 10 && hotResult ? "pass" : "warning",
        message: `Cache efficiency: ${hotTime}ms hot cache, ${(dbTime / hotTime).toFixed(1)}x speedup`,
        details: {
          coldCacheTime: coldTime,
          hotCacheTime: hotTime,
          databaseTime: dbTime,
          speedupFactor: dbTime / hotTime,
          rapidAccessAvg: avgRapidTime,
        },
        recommendations:
          hotTime > 10 || !hotResult
            ? [
                "Cache response time is slow",
                "Check Redis network latency",
                "Verify Redis server performance",
                "Consider Redis optimization",
              ]
            : [],
      })
    } catch (error) {
      console.error("❌ Cache efficiency test failed:", error.message)
    }
  }

  private generateReport(): void {
    console.log("\n" + "=".repeat(60))
    console.log("📋 REDIS HIT RATE DIAGNOSTIC REPORT")
    console.log("=".repeat(60))

    const passCount = this.results.filter((r) => r.status === "pass").length
    const warningCount = this.results.filter((r) => r.status === "warning").length
    const failCount = this.results.filter((r) => r.status === "fail").length

    console.log(`\n📊 Overall Status: ${passCount} Pass, ${warningCount} Warning, ${failCount} Fail`)

    // Group results by status
    const failedResults = this.results.filter((r) => r.status === "fail")
    const warningResults = this.results.filter((r) => r.status === "warning")

    if (failedResults.length > 0) {
      console.log("\n🚨 CRITICAL ISSUES:")
      failedResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.section}: ${result.message}`)
        if (result.recommendations) {
          result.recommendations.forEach((rec) => console.log(`   • ${rec}`))
        }
      })
    }

    if (warningResults.length > 0) {
      console.log("\n⚠️ WARNINGS:")
      warningResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.section}: ${result.message}`)
        if (result.recommendations) {
          result.recommendations.forEach((rec) => console.log(`   • ${rec}`))
        }
      })
    }

    // Generate specific recommendations
    console.log("\n🎯 RECOMMENDED ACTIONS:")

    if (failedResults.some((r) => r.section === "Redis Connection")) {
      console.log("1. Fix Redis Connection:")
      console.log("   npx tsx scripts/test-upstash-redis.ts")
      console.log("   Check REDIS_URL in .env.local")
    }

    if (this.results.some((r) => r.section === "Data Population" && r.status !== "pass")) {
      console.log("2. Improve Cache Population:")
      console.log("   npx tsx scripts/warm-redis-cache.ts")
      console.log("   Check cache warming logic in enhanced-hybrid-cache-service.ts")
    }

    if (warningResults.some((r) => r.section === "Cache Key Strategy")) {
      console.log("3. Optimize Cache Keys:")
      console.log("   Review key generation in cache service")
      console.log("   Implement consistent key naming patterns")
    }

    if (this.results.some((r) => r.section === "Eviction Policy" && r.status !== "pass")) {
      console.log("4. Adjust Eviction Policy:")
      console.log("   Configure Redis maxmemory-policy to allkeys-lru")
      console.log("   Increase Redis memory limit if needed")
    }

    console.log("\n🔧 NEXT STEPS:")
    console.log("1. Address critical issues first")
    console.log("2. Run cache warming: npx tsx scripts/warm-redis-cache.ts")
    console.log("3. Monitor dashboard for improvements")
    console.log("4. Re-run this diagnostic after changes")

    console.log("\n" + "=".repeat(60))
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// Run the diagnostic
async function main() {
  const diagnostic = new RedisHitRateDiagnostic()
  try {
    await diagnostic.runFullDiagnostic()
  } catch (error) {
    console.error("❌ Diagnostic failed:", error)
  } finally {
    await diagnostic.cleanup()
  }
}

if (require.main === module) {
  main()
}

export { RedisHitRateDiagnostic }
