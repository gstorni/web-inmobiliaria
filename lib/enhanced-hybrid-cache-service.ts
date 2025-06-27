import Redis from "ioredis"
import { sql } from "./neon-client"
import { secureTokkoClient } from "./enhanced-tokko-client"
import { transformTokkoProperty } from "./tokko-transformer"
import type { TransformedProperty } from "./tokko-types"

interface CacheMetrics {
  redis: {
    hits: number
    misses: number
    errors: number
    totalRequests: number
    avgResponseTime: number
    lastError?: string
    lastErrorTime?: string
  }
  neon: {
    hits: number
    misses: number
    errors: number
    totalRequests: number
    avgResponseTime: number
    lastError?: string
    lastErrorTime?: string
  }
  api: {
    calls: number
    errors: number
    totalRequests: number
    avgResponseTime: number
    lastError?: string
    lastErrorTime?: string
  }
  overall: {
    totalRequests: number
    cacheHitRate: number
    avgResponseTime: number
    uptime: number
  }
}

export class EnhancedHybridCacheService {
  private redis: Redis | null = null
  private redisConnected = false
  private neonConnected = false
  private metrics: CacheMetrics
  private startTime: number
  private responseTimes: { redis: number[]; neon: number[]; api: number[] }

  constructor() {
    this.startTime = Date.now()
    this.metrics = this.initializeMetrics()
    this.responseTimes = { redis: [], neon: [], api: [] }
    this.initializeRedis()
    this.testNeonConnection()
  }

  private initializeMetrics(): CacheMetrics {
    return {
      redis: {
        hits: 0,
        misses: 0,
        errors: 0,
        totalRequests: 0,
        avgResponseTime: 0,
      },
      neon: {
        hits: 0,
        misses: 0,
        errors: 0,
        totalRequests: 0,
        avgResponseTime: 0,
      },
      api: {
        calls: 0,
        errors: 0,
        totalRequests: 0,
        avgResponseTime: 0,
      },
      overall: {
        totalRequests: 0,
        cacheHitRate: 0,
        avgResponseTime: 0,
        uptime: 0,
      },
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) {
        console.log("📦 Redis not configured - running without Redis cache")
        return
      }

      console.log("🔄 Initializing Redis connection...")
      this.redis = new Redis(redisUrl, {
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 200,
        enableOfflineQueue: false,
        tls: redisUrl.includes("upstash.io") ? { rejectUnauthorized: false } : undefined,
      })

      this.redis.on("connect", () => {
        console.log("✅ Redis connected successfully")
        this.redisConnected = true
      })

      this.redis.on("error", (error) => {
        console.warn("⚠️ Redis error:", error.message)
        this.redisConnected = false
        this.recordError("redis", error.message)
      })

      await this.redis.connect()
      const result = await this.redis.ping()
      if (result === "PONG") {
        console.log("🚀 Redis cache tier active")
        this.redisConnected = true
      }
    } catch (error: any) {
      console.warn("⚠️ Redis initialization failed:", error.message)
      this.recordError("redis", error.message)
    }
  }

  private async testNeonConnection(): Promise<void> {
    try {
      await sql`SELECT 1 as test`
      console.log("✅ Neon database connected successfully")
      this.neonConnected = true
    } catch (error: any) {
      console.error("❌ Neon connection failed:", error.message)
      this.neonConnected = false
      this.recordError("neon", error.message)
    }
  }

  /**
   * TIER 1: Redis Cache Retrieval (< 1ms)
   */
  private async getFromRedis(propertyId: number): Promise<TransformedProperty | null> {
    if (!this.redis || !this.redisConnected) {
      this.metrics.redis.misses++
      return null
    }

    const startTime = Date.now()
    this.metrics.redis.totalRequests++

    try {
      const key = `property:${propertyId}`
      const cached = await this.redis.get(key)
      const responseTime = Date.now() - startTime

      this.recordResponseTime("redis", responseTime)

      if (cached) {
        this.metrics.redis.hits++
        console.log(`🚀 Redis HIT for property ${propertyId} (${responseTime}ms)`)
        return JSON.parse(cached)
      } else {
        this.metrics.redis.misses++
        console.log(`❌ Redis MISS for property ${propertyId}`)
        return null
      }
    } catch (error: any) {
      this.metrics.redis.errors++
      this.recordError("redis", error.message)
      console.error(`❌ Redis error for property ${propertyId}:`, error.message)
      return null
    }
  }

  /**
   * TIER 2: Neon Database Retrieval (~50ms)
   */
  private async getFromNeon(propertyId: number): Promise<TransformedProperty | null> {
    if (!this.neonConnected) {
      this.metrics.neon.misses++
      return null
    }

    const startTime = Date.now()
    this.metrics.neon.totalRequests++

    try {
      const result = await sql`
        SELECT 
          pc.*,
          COALESCE(
            json_agg(
              json_build_object(
                'url', COALESCE(pi.webp_url, pi.original_url),
                'description', pi.original_description,
                'order', pi.display_order
              ) ORDER BY pi.display_order
            ) FILTER (WHERE pi.id IS NOT NULL), 
            '[]'::json
          ) as images
        FROM properties_cache pc
        LEFT JOIN property_images_neon pi ON pc.tokko_id = pi.property_id
        WHERE pc.tokko_id = ${propertyId}
        GROUP BY pc.id
      `

      const responseTime = Date.now() - startTime
      this.recordResponseTime("neon", responseTime)

      if (result.length > 0) {
        this.metrics.neon.hits++
        console.log(`💾 Neon HIT for property ${propertyId} (${responseTime}ms)`)
        return this.transformCachedToProperty(result[0])
      } else {
        this.metrics.neon.misses++
        console.log(`❌ Neon MISS for property ${propertyId}`)
        return null
      }
    } catch (error: any) {
      this.metrics.neon.errors++
      this.recordError("neon", error.message)
      console.error(`❌ Neon error for property ${propertyId}:`, error.message)
      return null
    }
  }

  /**
   * TIER 3: API Retrieval (~500ms+)
   */
  private async getFromAPI(propertyId: number): Promise<TransformedProperty | null> {
    const startTime = Date.now()
    this.metrics.api.totalRequests++
    this.metrics.api.calls++

    try {
      console.log(`🌐 API call for property ${propertyId}`)
      const tokkoProperty = await secureTokkoClient.getProperty(propertyId)

      if (!tokkoProperty) {
        console.log(`❌ API: Property ${propertyId} not found`)
        return null
      }

      const transformed = transformTokkoProperty(tokkoProperty)
      const responseTime = Date.now() - startTime

      this.recordResponseTime("api", responseTime)
      console.log(`✅ API SUCCESS for property ${propertyId} (${responseTime}ms)`)

      return transformed
    } catch (error: any) {
      this.metrics.api.errors++
      this.recordError("api", error.message)
      console.error(`❌ API error for property ${propertyId}:`, error.message)
      return null
    }
  }

  /**
   * Cache Storage Operations
   */
  private async cacheInRedis(propertyId: number, property: TransformedProperty): Promise<void> {
    if (!this.redis || !this.redisConnected) return

    try {
      const key = `property:${propertyId}`
      const ttl = Number.parseInt(process.env.REDIS_TTL || "3600") // 1 hour default
      await this.redis.setex(key, ttl, JSON.stringify(property))
      console.log(`📝 Cached property ${propertyId} in Redis (TTL: ${ttl}s)`)
    } catch (error: any) {
      this.recordError("redis", error.message)
      console.error(`❌ Failed to cache property ${propertyId} in Redis:`, error.message)
    }
  }

  private async cacheInNeon(property: TransformedProperty): Promise<void> {
    if (!this.neonConnected) return

    try {
      await sql`
        INSERT INTO properties_cache (
          tokko_id, title, description, rich_description, reference_code,
          prices, main_price, available_operations, surface, covered_surface,
          uncovered_surface, total_surface, location_name, location_full,
          location_short, address, real_address, coordinates, property_type,
          property_type_code, operation_type, age, condition, situation,
          zonification, rooms, bathrooms, toilets, suites, parking_spaces,
          floors, orientation, amenities, tags, extra_attributes, contact_info,
          featured, status, transaction_requirements, has_temporary_rent,
          expenses, public_url, tokko_created_at, tokko_updated_at,
          sync_status, last_synced_at, updated_at
        ) VALUES (
          ${property.id}, ${property.title}, ${property.description}, ${property.richDescription}, 
          ${property.referenceCode}, ${JSON.stringify(property.prices)}, ${JSON.stringify(property.mainPrice)}, 
          ${property.availableOperations}, ${property.surface}, ${property.coveredSurface},
          ${property.uncoveredSurface}, ${property.totalSurface}, ${property.location.name}, 
          ${property.location.fullLocation}, ${property.location.shortLocation}, ${property.location.address}, 
          ${property.location.realAddress}, ${JSON.stringify(property.location.coordinates)}, 
          ${property.type}, ${property.typeCode}, ${property.operation}, ${property.age}, 
          ${property.condition}, ${property.situation}, ${property.zonification}, ${property.rooms}, 
          ${property.bathrooms}, ${property.toilets}, ${property.suites}, ${property.parkingSpaces}, 
          ${property.floors}, ${property.features.orientation}, ${property.features.amenities}, 
          ${property.features.amenities}, ${JSON.stringify(property.features.extraAttributes)}, 
          ${JSON.stringify(property.contact)}, ${property.featured}, ${property.status}, 
          ${property.transactionRequirements}, ${property.hasTemporaryRent}, ${property.expenses}, 
          ${property.publicUrl}, ${property.createdAt}, ${property.createdAt}, 'synced', NOW(), NOW()
        )
        ON CONFLICT (tokko_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          main_price = EXCLUDED.main_price,
          surface = EXCLUDED.surface,
          location_name = EXCLUDED.location_name,
          property_type_code = EXCLUDED.property_type_code,
          operation_type = EXCLUDED.operation_type,
          featured = EXCLUDED.featured,
          last_synced_at = NOW(),
          sync_status = 'synced',
          updated_at = NOW()
      `
      console.log(`📝 Cached property ${property.id} in Neon database`)
    } catch (error: any) {
      this.recordError("neon", error.message)
      console.error(`❌ Failed to cache property ${property.id} in Neon:`, error.message)
    }
  }

  /**
   * MAIN HYBRID RETRIEVAL METHOD
   * Priority: Redis -> Neon -> API
   * Caching: API -> (Redis + Neon), Neon -> Redis
   */
  async getProperty(propertyId: number): Promise<TransformedProperty | null> {
    const overallStartTime = Date.now()
    this.metrics.overall.totalRequests++

    console.log(`🔍 Retrieving property ${propertyId} via hybrid cache strategy`)

    try {
      // TIER 1: Try Redis first
      let property = await this.getFromRedis(propertyId)
      if (property) {
        this.updateOverallMetrics(overallStartTime, true)
        return property
      }

      // TIER 2: Try Neon database
      property = await this.getFromNeon(propertyId)
      if (property) {
        // Cache promotion: Neon -> Redis
        await this.cacheInRedis(propertyId, property)
        this.updateOverallMetrics(overallStartTime, true)
        return property
      }

      // TIER 3: Fetch from API
      property = await this.getFromAPI(propertyId)
      if (property) {
        // Cache in both tiers: API -> (Redis + Neon)
        await Promise.allSettled([this.cacheInRedis(propertyId, property), this.cacheInNeon(property)])
        this.updateOverallMetrics(overallStartTime, false)
        return property
      }

      // Property not found anywhere
      console.log(`❌ Property ${propertyId} not found in any tier`)
      this.updateOverallMetrics(overallStartTime, false)
      return null
    } catch (error: any) {
      console.error(`❌ Critical error retrieving property ${propertyId}:`, error.message)
      this.updateOverallMetrics(overallStartTime, false)
      return null
    }
  }

  /**
   * Cache Management Operations
   */
  async clearRedisCache(): Promise<{ success: boolean; message: string; keysCleared?: number }> {
    if (!this.redis || !this.redisConnected) {
      return { success: false, message: "Redis not connected" }
    }

    try {
      const keys = await this.redis.keys("property:*")
      const keysCleared = keys.length

      if (keysCleared > 0) {
        await this.redis.del(...keys)
      }

      // Reset Redis metrics
      this.metrics.redis.hits = 0
      this.metrics.redis.misses = 0
      this.metrics.redis.errors = 0

      console.log(`🗑️ Cleared ${keysCleared} keys from Redis cache`)
      return {
        success: true,
        message: `Successfully cleared ${keysCleared} properties from Redis cache`,
        keysCleared,
      }
    } catch (error: any) {
      this.recordError("redis", error.message)
      return { success: false, message: `Failed to clear Redis cache: ${error.message}` }
    }
  }

  async invalidateProperty(propertyId: number): Promise<{ success: boolean; message: string }> {
    const results = await Promise.allSettled([
      // Remove from Redis
      this.redis?.del(`property:${propertyId}`),
      // Mark as stale in Neon
      sql`UPDATE properties_cache SET sync_status = 'stale', updated_at = NOW() WHERE tokko_id = ${propertyId}`,
    ])

    console.log(`🗑️ Invalidated property ${propertyId}`)

    return {
      success: true,
      message: `Property ${propertyId} invalidated from cache tiers`,
    }
  }

  async warmCache(limit = 50): Promise<{ success: boolean; warmed: number; errors: number; message: string }> {
    console.log(`🔥 Starting cache warming for ${limit} properties`)

    try {
      const hotProperties = await sql`
        SELECT tokko_id 
        FROM properties_cache 
        WHERE featured = true OR sync_status = 'synced'
        ORDER BY updated_at DESC 
        LIMIT ${limit}
      `

      let warmed = 0
      let errors = 0

      for (const { tokko_id } of hotProperties) {
        try {
          const property = await this.getFromNeon(tokko_id)
          if (property) {
            await this.cacheInRedis(tokko_id, property)
            warmed++
          }
        } catch (error) {
          errors++
        }
      }

      const message = `Cache warming completed: ${warmed} properties warmed, ${errors} errors`
      console.log(`🔥 ${message}`)

      return { success: true, warmed, errors, message }
    } catch (error: any) {
      return { success: false, warmed: 0, errors: 1, message: `Cache warming failed: ${error.message}` }
    }
  }

  /**
   * Metrics and Monitoring
   */
  getMetrics(): CacheMetrics {
    // Update uptime
    this.metrics.overall.uptime = Date.now() - this.startTime

    // Calculate hit rates
    const totalCacheRequests = this.metrics.redis.hits + this.metrics.neon.hits
    const totalRequests = this.metrics.overall.totalRequests
    this.metrics.overall.cacheHitRate = totalRequests > 0 ? (totalCacheRequests / totalRequests) * 100 : 0

    return { ...this.metrics }
  }

  getConnectionStatus(): { redis: boolean; neon: boolean; overall: string } {
    const overall = this.redisConnected && this.neonConnected ? "optimal" : this.neonConnected ? "degraded" : "critical"

    return {
      redis: this.redisConnected,
      neon: this.neonConnected,
      overall,
    }
  }

  /**
   * Helper Methods
   */
  private recordResponseTime(tier: "redis" | "neon" | "api", time: number): void {
    this.responseTimes[tier].push(time)

    // Keep only last 100 measurements per tier
    if (this.responseTimes[tier].length > 100) {
      this.responseTimes[tier] = this.responseTimes[tier].slice(-100)
    }

    // Calculate average
    const times = this.responseTimes[tier]
    this.metrics[tier].avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length
  }

  private recordError(tier: "redis" | "neon" | "api", error: string): void {
    this.metrics[tier].lastError = error
    this.metrics[tier].lastErrorTime = new Date().toISOString()
  }

  private updateOverallMetrics(startTime: number, cacheHit: boolean): void {
    const responseTime = Date.now() - startTime

    // Update overall response time
    const allTimes = [...this.responseTimes.redis, ...this.responseTimes.neon, ...this.responseTimes.api]
    allTimes.push(responseTime)

    if (allTimes.length > 300) {
      allTimes.splice(0, allTimes.length - 300)
    }

    this.metrics.overall.avgResponseTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length
  }

  private transformCachedToProperty(cached: any): TransformedProperty {
    return {
      id: cached.tokko_id,
      title: cached.title,
      referenceCode: cached.reference_code || `REF-${cached.tokko_id}`,
      description: cached.description || "",
      richDescription: cached.rich_description || "",
      prices: cached.prices || [],
      mainPrice: cached.main_price,
      availableOperations: cached.available_operations || [],
      surface: cached.surface || 0,
      coveredSurface: cached.covered_surface || 0,
      uncoveredSurface: cached.uncovered_surface || 0,
      totalSurface: cached.total_surface || 0,
      location: {
        name: cached.location_name || "",
        fullLocation: cached.location_full || "",
        shortLocation: cached.location_short || "",
        address: cached.address || "",
        realAddress: cached.real_address || "",
        coordinates: {
          lat: cached.coordinates?.x,
          lng: cached.coordinates?.y,
        },
      },
      type: cached.property_type || "",
      typeCode: cached.property_type_code || "",
      operation: cached.operation_type || "",
      age: cached.age,
      condition: cached.condition || "",
      situation: cached.situation || "",
      zonification: cached.zonification || "",
      rooms: cached.rooms || 0,
      bathrooms: cached.bathrooms || 0,
      toilets: cached.toilets || 0,
      suites: cached.suites || 0,
      parkingSpaces: cached.parking_spaces || 0,
      floors: cached.floors || 1,
      features: {
        orientation: cached.orientation || "",
        amenities: cached.amenities || [],
        extraAttributes: cached.extra_attributes || [],
      },
      contact: cached.contact_info || {},
      featured: cached.featured || false,
      status: cached.status || 0,
      transactionRequirements: cached.transaction_requirements || "",
      hasTemporaryRent: cached.has_temporary_rent || false,
      expenses: cached.expenses || 0,
      publicUrl: cached.public_url,
      createdAt: cached.tokko_created_at,
      deletedAt: null,
      images: (cached.images || []).map((img: any) => ({
        url: img.url || img.avif_url || img.webp_url || img.original_url,
        description: img.description || "",
      })),
      videos: [],
    }
  }
}

// Singleton instance
export const enhancedHybridCache = new EnhancedHybridCacheService()
