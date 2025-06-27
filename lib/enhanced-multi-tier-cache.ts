import Redis from "ioredis"
import { sql } from "./neon-client"
import { secureTokkoClient } from "./enhanced-tokko-client"
import { transformTokkoProperty } from "./tokko-transformer"
import type { TransformedProperty } from "./tokko-types"

interface CacheMetrics {
  redis: { hits: number; misses: number; errors: number; responseTime: number[] }
  neon: { hits: number; misses: number; errors: number; responseTime: number[] }
  api: { calls: number; errors: number; responseTime: number[] }
}

interface CacheConfig {
  redis: {
    ttl: number
    maxMemory: string
    evictionPolicy: string
    hotThreshold: number
  }
  neon: {
    ttl: number
    maxCacheSize: number
    cleanupInterval: number
  }
  performance: {
    maxResponseTime: number
    alertThreshold: number
  }
}

export class EnhancedMultiTierCache {
  private redis: Redis | null = null
  private redisConnected = false
  private metrics: CacheMetrics = {
    redis: { hits: 0, misses: 0, errors: 0, responseTime: [] },
    neon: { hits: 0, misses: 0, errors: 0, responseTime: [] },
    api: { calls: 0, errors: 0, responseTime: [] },
  }

  private config: CacheConfig = {
    redis: {
      ttl: Number.parseInt(process.env.REDIS_TTL || "3600"),
      maxMemory: process.env.REDIS_MAX_MEMORY || "256mb",
      evictionPolicy: "allkeys-lru",
      hotThreshold: Number.parseInt(process.env.HOT_PROPERTY_THRESHOLD || "10"),
    },
    neon: {
      ttl: Number.parseInt(process.env.NEON_CACHE_TTL || "86400"),
      maxCacheSize: Number.parseInt(process.env.NEON_MAX_CACHE_SIZE || "100000"),
      cleanupInterval: Number.parseInt(process.env.NEON_CLEANUP_INTERVAL || "3600"),
    },
    performance: {
      maxResponseTime: Number.parseInt(process.env.MAX_RESPONSE_TIME || "1000"),
      alertThreshold: Number.parseInt(process.env.ALERT_THRESHOLD || "5000"),
    },
  }

  constructor() {
    this.initializeRedis()
    this.startPerformanceMonitoring()
  }

  private async initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL
      if (!redisUrl) {
        console.log("📦 Redis not configured - using Neon-only mode")
        return
      }

      this.redis = new Redis(redisUrl, {
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
      })

      this.redis.on("connect", () => {
        console.log("✅ Redis connected successfully")
        this.redisConnected = true
        this.configureRedis()
      })

      this.redis.on("error", (error) => {
        console.warn("⚠️ Redis error:", error.message)
        this.metrics.redis.errors++
        this.redisConnected = false
      })
    } catch (error) {
      console.warn("⚠️ Redis initialization failed:", error)
    }
  }

  private async configureRedis() {
    if (!this.redis || !this.redisConnected) return

    try {
      await this.redis.config("SET", "maxmemory", this.config.redis.maxMemory)
      await this.redis.config("SET", "maxmemory-policy", this.config.redis.evictionPolicy)
      console.log("✅ Redis configured successfully")
    } catch (error) {
      console.warn("⚠️ Redis configuration failed (continuing without custom config):", error.message)
    }
  }

  /**
   * TIER 1: Redis Cache (Hot Data)
   */
  private async getFromRedis(key: string): Promise<TransformedProperty | null> {
    if (!this.redis || !this.redisConnected) return null

    const startTime = Date.now()
    try {
      const cached = await this.redis.get(key)
      const responseTime = Date.now() - startTime

      this.metrics.redis.responseTime.push(responseTime)
      await this.recordMetric("hit", "redis", "property", key, responseTime)

      if (cached) {
        this.metrics.redis.hits++
        return JSON.parse(cached)
      } else {
        this.metrics.redis.misses++
        return null
      }
    } catch (error) {
      this.metrics.redis.errors++
      await this.recordMetric("error", "redis", "property", key, Date.now() - startTime)
      return null
    }
  }

  private async setToRedis(key: string, data: TransformedProperty, isHot = false): Promise<void> {
    if (!this.redis || !this.redisConnected) return

    try {
      if (isHot) {
        await this.redis.setex(key, this.config.redis.ttl, JSON.stringify(data))
        await this.updateHotPropertyRedisStatus(data.id, true)
        await this.recordMetric("write", "redis", "property", key)
      }
    } catch (error) {
      this.metrics.redis.errors++
      console.warn("Redis write error:", error)
    }
  }

  /**
   * TIER 2: Neon Cache (Primary cache)
   */
  private async getFromNeon(id: number): Promise<TransformedProperty | null> {
    const startTime = Date.now()
    try {
      // Update access tracking (safe - won't fail if property doesn't exist)
      await this.updatePropertyAccess(id)

      const result = await sql`
        SELECT 
          pc.*,
          COALESCE(
            json_agg(
              json_build_object(
                'url', COALESCE(pin.avif_url, pin.webp_url, pin.original_url),
                'description', pin.original_description,
                'order', pin.display_order
              ) ORDER BY pin.display_order
            ) FILTER (WHERE pin.id IS NOT NULL), 
            '[]'::json
          ) as images
        FROM properties_cache pc
        LEFT JOIN property_images_neon pin ON pc.tokko_id = pin.property_id
        WHERE pc.tokko_id = ${id}
        GROUP BY pc.id
      `

      const responseTime = Date.now() - startTime
      this.metrics.neon.responseTime.push(responseTime)

      if (result.length > 0) {
        this.metrics.neon.hits++
        await this.recordMetric("hit", "neon", "property", id.toString(), responseTime)

        const property = this.transformNeonToProperty(result[0])

        // Check if this should be promoted to Redis
        const isHot = await this.isHotProperty(id)
        if (isHot) {
          await this.setToRedis(`property:${id}`, property, true)
        }

        return property
      } else {
        this.metrics.neon.misses++
        await this.recordMetric("miss", "neon", "property", id.toString(), responseTime)
        return null
      }
    } catch (error) {
      this.metrics.neon.errors++
      await this.recordMetric("error", "neon", "property", id.toString(), Date.now() - startTime)
      console.error("Neon cache error:", error)
      return null
    }
  }

  private async setToNeon(property: TransformedProperty): Promise<void> {
    const startTime = Date.now()
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
          sync_status, last_synced_at
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
          ${property.publicUrl}, ${property.createdAt}, ${property.createdAt}, 'synced', NOW()
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

      await this.recordMetric("write", "neon", "property", property.id.toString(), Date.now() - startTime)
    } catch (error) {
      this.metrics.neon.errors++
      console.error("Neon write error:", error)
      throw error
    }
  }

  /**
   * TIER 3: Tokko API (Fallback)
   */
  private async getFromAPI(id: number): Promise<TransformedProperty | null> {
    const startTime = Date.now()
    try {
      this.metrics.api.calls++
      const tokkoProperty = await secureTokkoClient.getProperty(id)

      if (!tokkoProperty) return null

      const transformed = transformTokkoProperty(tokkoProperty)
      const responseTime = Date.now() - startTime

      this.metrics.api.responseTime.push(responseTime)
      await this.recordMetric("hit", "api", "property", id.toString(), responseTime)

      // Cache in Neon for future access
      await this.setToNeon(transformed)

      return transformed
    } catch (error) {
      this.metrics.api.errors++
      await this.recordMetric("error", "api", "property", id.toString(), Date.now() - startTime)
      console.error("API error:", error)
      return null
    }
  }

  /**
   * Main property retrieval method
   */
  async getProperty(id: number): Promise<{ property: TransformedProperty | null; source: string; hitRate: number }> {
    const key = `property:${id}`
    let property: TransformedProperty | null = null

    // Tier 1: Redis (hot properties only)
    property = await this.getFromRedis(key)
    if (property) {
      return { property, source: "redis", hitRate: this.getRedisHitRate() }
    }

    // Tier 2: Neon (primary cache)
    property = await this.getFromNeon(id)
    if (property) {
      return { property, source: "neon", hitRate: this.getNeonHitRate() }
    }

    // Tier 3: API (fallback)
    property = await this.getFromAPI(id)
    if (property) {
      return { property, source: "api", hitRate: 0 }
    }

    return { property: null, source: "miss", hitRate: 0 }
  }

  /**
   * Search with intelligent caching
   */
  async searchProperties(params: any): Promise<{
    properties: TransformedProperty[]
    total: number
    cached: boolean
    source: string
  }> {
    try {
      // Generate cache key from search parameters
      const queryHash = this.generateQueryHash(params)

      // Check search cache first
      const cachedSearch = await sql`
        SELECT result_ids, result_count, created_at
        FROM search_cache 
        WHERE cache_key = ${queryHash} AND expires_at > NOW()
      `

      if (cachedSearch.length > 0) {
        // Get properties from cache
        const propertyIds = cachedSearch[0].result_ids
        const properties = await this.getPropertiesByIds(propertyIds)

        return {
          properties,
          total: cachedSearch[0].result_count,
          cached: true,
          source: "neon-search-cache",
        }
      }

      // Execute fresh search
      const searchResult = await this.executeSearch(params)

      // Cache the search results
      await this.cacheSearchResults(queryHash, params, searchResult)

      return {
        ...searchResult,
        cached: false,
        source: "neon-fresh",
      }
    } catch (error) {
      console.error("Search error:", error)
      return { properties: [], total: 0, cached: false, source: "error" }
    }
  }

  /**
   * Helper methods
   */
  private async updatePropertyAccess(id: number): Promise<void> {
    try {
      // This function now safely handles missing properties
      await sql`SELECT update_hot_property(${id})`
    } catch (error) {
      console.warn("Failed to update property access:", error)
    }
  }

  private async isHotProperty(id: number): Promise<boolean> {
    try {
      const result = await sql`
        SELECT heat_score FROM hot_properties WHERE tokko_id = ${id}
      `
      return result.length > 0 && result[0].heat_score >= this.config.redis.hotThreshold
    } catch (error) {
      return false
    }
  }

  private async updateHotPropertyRedisStatus(id: number, cached: boolean): Promise<void> {
    try {
      await sql`
        UPDATE hot_properties 
        SET redis_cached = ${cached}, redis_cached_at = CASE WHEN ${cached} THEN NOW() ELSE redis_cached_at END
        WHERE tokko_id = ${id}
      `
    } catch (error) {
      console.warn("Failed to update Redis status:", error)
    }
  }

  private generateQueryHash(params: any): string {
    const normalized = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key]
        return result
      }, {} as any)

    return Buffer.from(JSON.stringify(normalized)).toString("base64")
  }

  private async executeSearch(params: any): Promise<{ properties: TransformedProperty[]; total: number }> {
    try {
      // Build base query
      const whereConditions = []

      if (params.query) {
        whereConditions.push(
          `(pc.title ILIKE '%' || ${params.query} || '%' OR pc.description ILIKE '%' || ${params.query} || '%')`,
        )
      }

      if (params.type) {
        whereConditions.push(`pc.property_type_code = ${params.type}`)
      }

      if (params.operation) {
        whereConditions.push(`pc.operation_type = ${params.operation}`)
      }

      if (params.featured) {
        whereConditions.push(`pc.featured = true`)
      }

      if (params.minPrice) {
        whereConditions.push(`(pc.main_price->>'price')::numeric >= ${params.minPrice}`)
      }

      if (params.maxPrice) {
        whereConditions.push(`(pc.main_price->>'price')::numeric <= ${params.maxPrice}`)
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""
      const limit = params.limit || 20
      const offset = params.offset || 0

      // Execute search query
      const results = await sql`
        SELECT pc.*, 
          COALESCE(
            json_agg(
              json_build_object(
                'url', COALESCE(pin.avif_url, pin.webp_url, pin.original_url),
                'description', pin.original_description
              ) ORDER BY pin.display_order
            ) FILTER (WHERE pin.id IS NOT NULL), 
            '[]'::json
          ) as images
        FROM properties_cache pc
        LEFT JOIN property_images_neon pin ON pc.tokko_id = pin.property_id
        ${whereClause ? sql.unsafe(whereClause) : sql``}
        GROUP BY pc.id 
        ORDER BY pc.featured DESC, pc.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `

      const properties = results.map((row) => this.transformNeonToProperty(row))

      // Get total count
      const countResult = await sql`
        SELECT COUNT(DISTINCT pc.id) as total 
        FROM properties_cache pc
        ${whereClause ? sql.unsafe(whereClause) : sql``}
      `

      const total = countResult[0]?.total || 0

      return { properties, total }
    } catch (error) {
      console.error("Search execution error:", error)
      return { properties: [], total: 0 }
    }
  }

  private async getPropertiesByIds(ids: number[]): Promise<TransformedProperty[]> {
    if (ids.length === 0) return []

    try {
      const results = await sql`
        SELECT pc.*, 
          COALESCE(
            json_agg(
              json_build_object(
                'url', COALESCE(pin.avif_url, pin.webp_url, pin.original_url),
                'description', pin.original_description
              ) ORDER BY pin.display_order
            ) FILTER (WHERE pin.id IS NOT NULL), 
            '[]'::json
          ) as images
        FROM properties_cache pc
        LEFT JOIN property_images_neon pin ON pc.tokko_id = pin.property_id
        WHERE pc.tokko_id = ANY(${ids})
        GROUP BY pc.id
        ORDER BY pc.featured DESC, pc.updated_at DESC
      `

      return results.map((row) => this.transformNeonToProperty(row))
    } catch (error) {
      console.error("Error getting properties by IDs:", error)
      return []
    }
  }

  private async cacheSearchResults(queryHash: string, params: any, result: any): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + this.config.neon.ttl * 1000)
      const propertyIds = result.properties.map((p: any) => p.id)

      await sql`
        INSERT INTO search_cache (cache_key, query_params, result_count, result_ids, expires_at)
        VALUES (${queryHash}, ${JSON.stringify(params)}, ${result.total}, ${propertyIds}, ${expiresAt})
        ON CONFLICT (cache_key) DO UPDATE SET
          result_count = EXCLUDED.result_count,
          result_ids = EXCLUDED.result_ids,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW()
      `
    } catch (error) {
      console.warn("Failed to cache search results:", error)
    }
  }

  private transformNeonToProperty(row: any): TransformedProperty {
    return {
      id: row.tokko_id,
      title: row.title || "",
      referenceCode: row.reference_code || `REF-${row.tokko_id}`,
      description: row.description || "",
      richDescription: row.rich_description || "",
      prices: row.prices || [],
      mainPrice: row.main_price || {
        price: 0,
        currency: "ARS",
        formatted: "Consulte precio",
        operation: "Consultar",
      },
      availableOperations: row.available_operations || [],
      surface: row.surface || 0,
      coveredSurface: row.covered_surface || 0,
      uncoveredSurface: row.uncovered_surface || 0,
      totalSurface: row.total_surface || 0,
      location: {
        name: row.location_name || "",
        fullLocation: row.location_full || "",
        shortLocation: row.location_short || "",
        address: row.address || "",
        realAddress: row.real_address || "",
        coordinates: row.coordinates || { lat: 0, lng: 0 },
      },
      type: row.property_type || "",
      typeCode: row.property_type_code || "",
      operation: row.operation_type || "",
      age: row.age,
      condition: row.condition || "",
      situation: row.situation || "",
      zonification: row.zonification || "",
      rooms: row.rooms || 0,
      bathrooms: row.bathrooms || 0,
      toilets: row.toilets || 0,
      suites: row.suites || 0,
      parkingSpaces: row.parking_spaces || 0,
      floors: row.floors || 1,
      features: {
        orientation: row.orientation || "",
        amenities: row.amenities || [],
        extraAttributes: row.extra_attributes || [],
      },
      contact: row.contact_info || {},
      featured: row.featured || false,
      status: row.status || 0,
      transactionRequirements: row.transaction_requirements || "",
      hasTemporaryRent: row.has_temporary_rent || false,
      expenses: row.expenses || 0,
      publicUrl: row.public_url,
      createdAt: row.tokko_created_at,
      deletedAt: null,
      images: row.images || [],
      videos: [],
    }
  }

  private async recordMetric(
    type: string,
    layer: string,
    resourceType: string,
    resourceId?: string,
    responseTime?: number,
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO performance_metrics (metric_type, metric_name, metric_value, metadata, recorded_at)
        VALUES (${type}, ${`${layer}_${resourceType}`}, ${responseTime || 0}, 
                ${JSON.stringify({ layer, resourceType, resourceId })}, NOW())
      `
    } catch (error) {
      // Silently fail to avoid impacting performance
    }
  }

  private getRedisHitRate(): number {
    const total = this.metrics.redis.hits + this.metrics.redis.misses
    return total > 0 ? (this.metrics.redis.hits / total) * 100 : 0
  }

  private getNeonHitRate(): number {
    const total = this.metrics.neon.hits + this.metrics.neon.misses
    return total > 0 ? (this.metrics.neon.hits / total) * 100 : 0
  }

  private startPerformanceMonitoring(): void {
    setInterval(async () => {
      try {
        await this.cleanupOldData()
        await this.optimizeCachePerformance()
      } catch (error) {
        console.warn("Performance monitoring error:", error)
      }
    }, this.config.neon.cleanupInterval * 1000)
  }

  private async cleanupOldData(): Promise<void> {
    try {
      await sql`DELETE FROM performance_metrics WHERE recorded_at < NOW() - INTERVAL '7 days'`
      await sql`DELETE FROM search_cache WHERE expires_at < NOW()`
    } catch (error) {
      console.warn("Cleanup error:", error)
    }
  }

  private async optimizeCachePerformance(): Promise<void> {
    try {
      // Identify and promote hot properties to Redis
      const hotProperties = await sql`
        SELECT tokko_id, heat_score 
        FROM hot_properties 
        WHERE heat_score >= ${this.config.redis.hotThreshold} AND (redis_cached = false OR redis_cached IS NULL)
        ORDER BY heat_score DESC 
        LIMIT 100
      `

      for (const hot of hotProperties) {
        const property = await this.getFromNeon(hot.tokko_id)
        if (property) {
          await this.setToRedis(`property:${hot.tokko_id}`, property, true)
        }
      }
    } catch (error) {
      console.warn("Performance optimization error:", error)
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStats(): Promise<any> {
    const [neonStats, redisStats, performanceStats] = await Promise.all([
      this.getNeonStats(),
      this.getRedisStats(),
      this.getPerformanceStats(),
    ])

    return {
      neon: neonStats,
      redis: redisStats,
      performance: performanceStats,
      metrics: this.metrics,
    }
  }

  private async getNeonStats(): Promise<any> {
    try {
      const stats = await sql`
        SELECT 
          (SELECT COUNT(*) FROM properties_cache) as total_properties,
          (SELECT COUNT(*) FROM properties_cache WHERE featured = true) as featured_properties,
          (SELECT COUNT(*) FROM property_images_neon WHERE processing_status = 'completed') as processed_images,
          (SELECT COUNT(*) FROM property_images_neon WHERE processing_status = 'pending') as pending_images,
          (SELECT COUNT(*) FROM hot_properties WHERE redis_cached = true) as redis_cached_properties,
          (SELECT AVG(heat_score) FROM hot_properties) as avg_heat_score
      `

      return stats[0] || {}
    } catch (error) {
      return {}
    }
  }

  private async getRedisStats(): Promise<any> {
    if (!this.redis || !this.redisConnected) {
      return { connected: false, keys: 0, memory: "0B" }
    }

    try {
      const info = await this.redis.info("memory")
      const keyCount = await this.redis.dbsize()

      return {
        connected: true,
        keys: keyCount,
        memory: this.parseRedisMemory(info),
        hitRate: this.getRedisHitRate(),
      }
    } catch (error) {
      return { connected: false, error: error.message }
    }
  }

  private async getPerformanceStats(): Promise<any> {
    try {
      const recentMetrics = await sql`
        SELECT 
          metadata->>'layer' as cache_layer,
          AVG(metric_value) as avg_response_time,
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE metric_type = 'hit') as hits,
          COUNT(*) FILTER (WHERE metric_type = 'miss') as misses,
          COUNT(*) FILTER (WHERE metric_type = 'error') as errors
        FROM performance_metrics 
        WHERE recorded_at > NOW() - INTERVAL '1 hour'
        GROUP BY metadata->>'layer'
      `

      return recentMetrics.reduce((acc, metric) => {
        acc[metric.cache_layer] = {
          avgResponseTime: Math.round(metric.avg_response_time),
          totalRequests: metric.total_requests,
          hits: metric.hits,
          misses: metric.misses,
          errors: metric.errors,
          hitRate: metric.total_requests > 0 ? (metric.hits / metric.total_requests) * 100 : 0,
        }
        return acc
      }, {})
    } catch (error) {
      return {}
    }
  }

  private parseRedisMemory(info: string): string {
    const match = info.match(/used_memory_human:(.+)/)
    return match ? match[1].trim() : "0B"
  }
}

export const enhancedMultiTierCache = new EnhancedMultiTierCache()
