import dotenv from "dotenv"
import Redis from "ioredis"

dotenv.config({ path: ".env.local" })

class RedisCacheWarmer {
  private redis: Redis | null = null
  private supabase: any = null
  private initializationErrors: string[] = []

  constructor() {
    // Don't initialize in constructor - do it explicitly
  }

  async initialize(): Promise<{ success: boolean; errors: string[] }> {
    console.log("🔧 Initializing connections...")
    this.initializationErrors = []

    // Check environment variables first
    console.log("\n📋 Environment Variables Check:")
    console.log("REDIS_URL:", process.env.REDIS_URL ? "✅ Set" : "❌ Not set")
    console.log("NEXT_PUBLIC_SUPABASE_URL:", /* Supabase URL removed */ ? "✅ Set" : "❌ Not set")
    console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", /* Supabase key removed */ ? "✅ Set" : "❌ Not set")

    // Initialize Redis
    await this.initializeRedis()

    // Initialize Supabase
    await this.initializeSupabase()

    const success = this.redis !== null && this.supabase !== null
    return { success, errors: this.initializationErrors }
  }

  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL

    if (!redisUrl) {
      const error = "❌ REDIS_URL environment variable not found"
      console.log(error)
      this.initializationErrors.push(error)
      return
    }

    console.log("\n🔄 Connecting to Redis...")
    console.log("Redis URL:", redisUrl.substring(0, 20) + "...")

    try {
      const isUpstash = redisUrl.includes("upstash.io")
      console.log("Redis type:", isUpstash ? "Upstash" : "Standard")

      this.redis = new Redis(redisUrl, {
        connectTimeout: 15000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        ...(isUpstash && {
          tls: {
            rejectUnauthorized: false,
          },
          family: 4,
        }),
      })

      // Set up event handlers for debugging
      this.redis.on("connect", () => {
        console.log("🔗 Redis: Connection established")
      })

      this.redis.on("ready", () => {
        console.log("✅ Redis: Ready and operational")
      })

      this.redis.on("error", (error) => {
        console.error("❌ Redis error:", error.message)
        this.initializationErrors.push(`Redis error: ${error.message}`)
      })

      // Test connection
      console.log("🏓 Testing Redis connection...")
      await this.redis.connect()

      // Wait for connection to stabilize
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const pingResult = await this.redis.ping()
      console.log("🏓 Ping result:", pingResult)

      if (pingResult === "PONG") {
        console.log("✅ Redis connection successful")

        // Test basic operations
        await this.redis.set("test-key", "test-value", "EX", 60)
        const testValue = await this.redis.get("test-key")

        if (testValue === "test-value") {
          console.log("✅ Redis read/write test successful")
          await this.redis.del("test-key")
        } else {
          throw new Error("Redis read/write test failed")
        }
      } else {
        throw new Error(`Invalid ping response: ${pingResult}`)
      }
    } catch (error) {
      const errorMsg = `Redis initialization failed: ${error.message}`
      console.error("❌", errorMsg)
      this.initializationErrors.push(errorMsg)
      this.redis = null
    }
  }

  private async initializeSupabase(): Promise<void> {
    const supabaseUrl = null
    const supabaseKey = null

    if (!supabaseUrl || !supabaseKey) {
      const error = "❌ Supabase environment variables not found"
      console.log(error)
      this.initializationErrors.push(error)
      return
    }

    console.log("\n🔄 Connecting to Supabase...")
    console.log("Supabase URL:", supabaseUrl)

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
              signal: AbortSignal.timeout(30000), // 30 seconds
            })
          },
        },
      })

      // Test connection
      console.log("🧪 Testing Supabase connection...")
      const { data, error } = await this.supabase
        .from("properties_cache")
        .select("count", { count: "exact", head: true })

      if (error) {
        throw new Error(`Supabase test query failed: ${error.message}`)
      }

      console.log("✅ Supabase connection successful")
      console.log(`📊 Found ${data || 0} properties in cache`)
    } catch (error) {
      const errorMsg = `Supabase initialization failed: ${error.message}`
      console.error("❌", errorMsg)
      this.initializationErrors.push(errorMsg)
      this.supabase = null
    }
  }

  async warmCache(
    options: {
      maxProperties?: number
      prioritizeFeatured?: boolean
      includeImages?: boolean
      ttl?: number
    } = {},
  ): Promise<void> {
    const { maxProperties = 100, prioritizeFeatured = true, includeImages = true, ttl = 7200 } = options

    if (!this.redis || !this.supabase) {
      throw new Error("Redis or Supabase not available. Run initialization first.")
    }

    console.log("\n🔥 Starting Redis cache warming...")
    console.log(`📊 Target: ${maxProperties} properties, TTL: ${ttl}s`)

    try {
      // Build query
      let query = this.supabase.from("properties_cache").select("*")

      if (prioritizeFeatured) {
        query = query.order("featured", { ascending: false })
      }

      query = query.order("updated_at", { ascending: false }).limit(maxProperties)

      console.log("📦 Fetching properties from Supabase...")
      const { data: properties, error } = await query

      if (error) {
        throw new Error(`Failed to fetch properties: ${error.message}`)
      }

      if (!properties || properties.length === 0) {
        console.log("❌ No properties found to cache")
        return
      }

      console.log(`📦 Fetched ${properties.length} properties from Supabase`)

      // Warm cache with properties
      let warmed = 0
      let errors = 0

      for (const property of properties) {
        try {
          const cacheKey = `property:${property.tokko_id}`

          // Check if already cached
          const exists = await this.redis.exists(cacheKey)
          if (exists) {
            console.log(`⏭️ Skipping ${property.tokko_id} (already cached)`)
            continue
          }

          // Prepare cache data
          const cacheData = {
            id: property.tokko_id,
            title: property.title,
            referenceCode: property.reference_code || `REF-${property.tokko_id}`,
            description: property.description || "",
            richDescription: property.rich_description || "",
            prices: property.prices || [],
            mainPrice: property.main_price,
            availableOperations: property.available_operations || [],
            surface: property.surface || 0,
            coveredSurface: property.covered_surface || 0,
            uncoveredSurface: property.uncovered_surface || 0,
            totalSurface: property.total_surface || 0,
            location: {
              name: property.location_name || "",
              fullLocation: property.location_full || "",
              shortLocation: property.location_short || "",
              address: property.address || "",
              realAddress: property.real_address || "",
              coordinates: {
                lat: property.coordinates?.x,
                lng: property.coordinates?.y,
              },
            },
            type: property.property_type || "",
            typeCode: property.property_type_code || "",
            operation: property.operation_type || "",
            age: property.age,
            condition: property.condition || "",
            situation: property.situation || "",
            zonification: property.zonification || "",
            rooms: property.rooms || 0,
            bathrooms: property.bathrooms || 0,
            toilets: property.toilets || 0,
            suites: property.suites || 0,
            parkingSpaces: property.parking_spaces || 0,
            floors: property.floors || 1,
            features: {
              orientation: property.orientation || "",
              amenities: property.amenities || [],
              extraAttributes: property.extra_attributes || [],
            },
            contact: property.contact_info || {},
            featured: property.featured || false,
            status: property.status || 0,
            transactionRequirements: property.transaction_requirements || "",
            hasTemporaryRent: property.has_temporary_rent || false,
            expenses: property.expenses || 0,
            publicUrl: property.public_url,
            createdAt: property.tokko_created_at,
            deletedAt: null,
            images: [],
            videos: [],
          }

          // Add images if requested
          if (includeImages) {
            const { data: images } = await this.supabase
              .from("property_images")
              .select("*")
              .eq("property_id", property.tokko_id)
              .order("display_order")

            if (images) {
              cacheData.images = images.map((img: any) => ({
                url: img.avif_url || img.webp_url || img.original_url,
                description: img.original_description || "",
              }))
            }
          }

          // Cache the property
          await this.redis.setex(cacheKey, ttl, JSON.stringify(cacheData))

          // Track access for LRU
          await this.redis.zadd("property_access", Date.now(), cacheKey)

          warmed++
          console.log(`✅ Cached property ${property.tokko_id} (${warmed}/${properties.length})`)

          // Small delay to avoid overwhelming Redis
          if (warmed % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        } catch (error) {
          errors++
          console.error(`❌ Failed to cache property ${property.tokko_id}:`, error.message)
        }
      }

      // Warm popular search queries
      await this.warmPopularSearches(ttl)

      console.log(`\n🎉 Cache warming completed!`)
      console.log(`✅ Successfully cached: ${warmed} properties`)
      console.log(`❌ Errors: ${errors}`)

      // Update cache size tracking
      const totalKeys = await this.redis.dbsize()
      console.log(`🔧 Total Redis keys: ${totalKeys}`)
    } catch (error) {
      console.error("❌ Cache warming failed:", error.message)
      throw error
    }
  }

  private async warmPopularSearches(ttl: number): Promise<void> {
    if (!this.redis || !this.supabase) return

    console.log("\n🔍 Warming popular search queries...")

    const popularSearches = [
      { query: "", type: "industrial", operation: "sale", limit: 20 },
      { query: "", type: "warehouse", operation: "rent", limit: 20 },
      { query: "", type: "office", operation: "sale", limit: 20 },
      { query: "zona norte", type: "", operation: "", limit: 20 },
      { query: "capital federal", type: "", operation: "", limit: 20 },
    ]

    for (const search of popularSearches) {
      try {
        const searchKey = `search:${[
          search.query || "all",
          search.type || "any",
          search.operation || "any",
          "0", // minPrice
          "max", // maxPrice
          "any", // location
          search.limit.toString(),
          "0", // offset
        ].join(":")}`

        // Check if already cached
        const exists = await this.redis.exists(searchKey)
        if (exists) {
          console.log(`⏭️ Skipping search cache (already exists)`)
          continue
        }

        // Build search query
        let query = this.supabase.from("properties_cache").select("*", { count: "exact" })

        if (search.type) {
          query = query.eq("property_type_code", search.type)
        }
        if (search.operation) {
          query = query.eq("operation_type", search.operation)
        }
        if (search.query) {
          query = query.ilike("title", `%${search.query}%`)
        }

        query = query.order("featured", { ascending: false }).limit(search.limit)

        const { data, count, error } = await query

        if (error) {
          console.error(`❌ Search query failed:`, error.message)
          continue
        }

        const searchResult = {
          properties: (data || []).map((prop) => ({
            id: prop.tokko_id,
            title: prop.title,
            mainPrice: prop.main_price,
            location: { name: prop.location_name },
            type: prop.property_type,
            operation: prop.operation_type,
            featured: prop.featured,
          })),
          total: count || 0,
        }

        await this.redis.setex(searchKey, ttl / 2, JSON.stringify(searchResult)) // Shorter TTL for searches

        console.log(`✅ Cached search: ${searchKey.split(":")[1]} (${searchResult.total} results)`)
      } catch (error) {
        console.error(`❌ Failed to cache search:`, error.message)
      }
    }
  }

  async getWarmingStats(): Promise<{
    totalKeys: number
    propertyKeys: number
    searchKeys: number
    memoryUsage: string
  }> {
    if (!this.redis) {
      throw new Error("Redis not available")
    }

    const totalKeys = await this.redis.dbsize()
    const propertyKeys = await this.redis.keys("property:*")
    const searchKeys = await this.redis.keys("search:*")

    const info = await this.redis.info("memory")
    const memoryLine = info.split("\r\n").find((line) => line.startsWith("used_memory_human:"))
    const memoryUsage = memoryLine?.split(":")[1] || "Unknown"

    return {
      totalKeys,
      propertyKeys: propertyKeys.length,
      searchKeys: searchKeys.length,
      memoryUsage,
    }
  }

  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
    }
  }
}

// CLI interface
async function main() {
  const warmer = new RedisCacheWarmer()

  try {
    const args = process.argv.slice(2)
    const maxProperties = Number.parseInt(args.find((arg) => arg.startsWith("--max="))?.split("=")[1] || "100")
    const includeImages = !args.includes("--no-images")
    const prioritizeFeatured = !args.includes("--no-priority")

    console.log("🚀 Redis Cache Warming Tool")
    console.log("=".repeat(40))

    // Initialize connections with detailed diagnostics
    const initResult = await warmer.initialize()

    if (!initResult.success) {
      console.log("\n❌ Initialization failed!")
      console.log("Errors:")
      initResult.errors.forEach((error) => console.log(`   ${error}`))

      console.log("\n🔧 Troubleshooting Steps:")
      console.log("1. Check your .env.local file exists and contains:")
      console.log("   REDIS_URL=your_redis_url")
      console.log("   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url")
      console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key")
      console.log("2. Verify Redis is accessible (try: redis-cli ping)")
      console.log("3. Verify Supabase credentials are correct")
      console.log("4. Check if properties_cache table exists in Supabase")

      process.exit(1)
    }

    console.log("\n✅ All connections established successfully!")

    await warmer.warmCache({
      maxProperties,
      includeImages,
      prioritizeFeatured,
      ttl: 7200, // 2 hours
    })

    const stats = await warmer.getWarmingStats()
    console.log("\n📊 Final Stats:")
    console.log(`   Total Keys: ${stats.totalKeys}`)
    console.log(`   Property Keys: ${stats.propertyKeys}`)
    console.log(`   Search Keys: ${stats.searchKeys}`)
    console.log(`   Memory Usage: ${stats.memoryUsage}`)
  } catch (error) {
    console.error("❌ Cache warming failed:", error.message)
    process.exit(1)
  } finally {
    await warmer.cleanup()
  }
}

if (require.main === module) {
  main()
}

export { RedisCacheWarmer }
