import dotenv from "dotenv"
import Redis from "ioredis"

dotenv.config({ path: ".env.local" })

async function testCacheHitRate() {
  console.log("🎯 Testing Cache Hit Rate Performance")
  console.log("=".repeat(50))

  // Initialize connections
  const redis = new Redis(process.env.REDIS_URL!, {
    connectTimeout: 5000,
    lazyConnect: true,
    tls: process.env.REDIS_URL!.includes("upstash.io") ? {} : undefined,
  })

  const supabase = createClient(/* Supabase URL removed */!, /* Supabase key removed */!)

  try {
    await redis.connect()
    console.log("✅ Connected to Redis")

    // Get some property IDs from cache
    const propertyKeys = await redis.keys("property:*")
    console.log(`📦 Found ${propertyKeys.length} cached properties`)

    if (propertyKeys.length === 0) {
      console.log("❌ No properties in cache. Run cache warming first!")
      return
    }

    // Test cache hit rate with multiple requests
    const testPropertyIds = propertyKeys.slice(0, 20).map((key) => key.split(":")[1])
    console.log(`🧪 Testing with ${testPropertyIds.length} properties`)

    let cacheHits = 0
    let cacheMisses = 0
    const responseTimes: number[] = []

    console.log("\n🔍 Testing cache performance...")

    for (const propertyId of testPropertyIds) {
      const start = Date.now()

      // Test Redis first (this should be a hit)
      const cached = await redis.get(`property:${propertyId}`)
      const responseTime = Date.now() - start
      responseTimes.push(responseTime)

      if (cached) {
        cacheHits++
        console.log(`✅ Property ${propertyId}: HIT (${responseTime}ms)`)
      } else {
        cacheMisses++
        console.log(`❌ Property ${propertyId}: MISS (${responseTime}ms)`)
      }
    }

    // Calculate statistics
    const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    const minResponseTime = Math.min(...responseTimes)
    const maxResponseTime = Math.max(...responseTimes)

    console.log("\n📊 CACHE PERFORMANCE RESULTS:")
    console.log("=".repeat(40))
    console.log(`🎯 Hit Rate: ${hitRate.toFixed(1)}% (${cacheHits}/${cacheHits + cacheMisses})`)
    console.log(`⚡ Avg Response Time: ${avgResponseTime.toFixed(2)}ms`)
    console.log(`🚀 Min Response Time: ${minResponseTime}ms`)
    console.log(`🐌 Max Response Time: ${maxResponseTime}ms`)

    // Test some properties that shouldn't be cached
    console.log("\n🧪 Testing cache misses (random IDs)...")
    const randomIds = [999999, 888888, 777777]
    let expectedMisses = 0

    for (const randomId of randomIds) {
      const start = Date.now()
      const cached = await redis.get(`property:${randomId}`)
      const responseTime = Date.now() - start

      if (!cached) {
        expectedMisses++
        console.log(`✅ Property ${randomId}: Expected MISS (${responseTime}ms)`)
      } else {
        console.log(`⚠️ Property ${randomId}: Unexpected HIT (${responseTime}ms)`)
      }
    }

    // Get Redis internal stats
    const info = await redis.info()
    const keyspaceHits = info.match(/keyspace_hits:(\d+)/)?.[1] || "0"
    const keyspaceMisses = info.match(/keyspace_misses:(\d+)/)?.[1] || "0"
    const totalRequests = Number.parseInt(keyspaceHits) + Number.parseInt(keyspaceMisses)
    const internalHitRate = totalRequests > 0 ? (Number.parseInt(keyspaceHits) / totalRequests) * 100 : 0

    console.log("\n📈 REDIS INTERNAL STATS:")
    console.log("=".repeat(40))
    console.log(`🎯 Internal Hit Rate: ${internalHitRate.toFixed(1)}%`)
    console.log(`✅ Total Hits: ${keyspaceHits}`)
    console.log(`❌ Total Misses: ${keyspaceMisses}`)

    // Performance assessment
    console.log("\n🏆 PERFORMANCE ASSESSMENT:")
    console.log("=".repeat(40))

    if (hitRate >= 90) {
      console.log("🟢 EXCELLENT: Cache hit rate is optimal!")
    } else if (hitRate >= 70) {
      console.log("🟡 GOOD: Cache hit rate is acceptable")
    } else if (hitRate >= 50) {
      console.log("🟠 FAIR: Cache hit rate needs improvement")
    } else {
      console.log("🔴 POOR: Cache hit rate is too low")
    }

    if (avgResponseTime <= 5) {
      console.log("🟢 EXCELLENT: Response times are optimal!")
    } else if (avgResponseTime <= 20) {
      console.log("🟡 GOOD: Response times are acceptable")
    } else {
      console.log("🟠 SLOW: Response times could be improved")
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS:")
    console.log("=".repeat(40))

    if (hitRate < 80) {
      console.log("• Run cache warming more frequently")
      console.log("• Increase cache TTL if data doesn't change often")
      console.log("• Monitor which properties are accessed most")
    }

    if (avgResponseTime > 10) {
      console.log("• Check Redis server performance")
      console.log("• Consider Redis server location/latency")
      console.log("• Monitor Redis memory usage")
    }

    console.log("• Monitor dashboard at /enhanced-dashboard")
    console.log("• Set up automatic cache warming")
  } catch (error) {
    console.error("❌ Test failed:", error.message)
  } finally {
    await redis.quit()
  }
}

testCacheHitRate()
