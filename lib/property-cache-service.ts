import type { TransformedProperty } from "./tokko-types"
import { transformTokkoProperty } from "./tokko-transformer"
import { secureTokkoClient } from "./enhanced-tokko-client"
import { checkpointService } from "./checkpoint-service"

export class PropertyCacheService {
  private static instance: PropertyCacheService

  static getInstance(): PropertyCacheService {
    if (!PropertyCacheService.instance) {
      PropertyCacheService.instance = new PropertyCacheService()
    }
    return PropertyCacheService.instance
  }

  /**
   * Search properties in cache with full-text search and filters
   */
  async searchProperties(params: {
    query?: string
    type?: string
    operation?: string
    tags?: string[]
    minPrice?: number
    maxPrice?: number
    minSurface?: number
    maxSurface?: number
    featured?: boolean
    limit?: number
    offset?: number
  }): Promise<{
    properties: TransformedProperty[]
    total: number
    hasNext: boolean
    hasPrevious: boolean
  }> {
    console.log("🔍 Searching cached properties with params:", params)

    let query = supabase.from("properties_with_images").select("*", { count: "exact" })

    // Full-text search
    if (params.query?.trim()) {
      query = query.textSearch("search_vector", params.query.trim(), {
        type: "websearch",
        config: "spanish",
      })
    }

    // Property type filter
    if (params.type) {
      query = query.eq("property_type_code", params.type)
    }

    // Operation filter
    if (params.operation) {
      query = query.eq("operation_type", params.operation)
    }

    // Featured filter
    if (params.featured !== undefined) {
      query = query.eq("featured", params.featured)
    }

    // Price range
    if (params.minPrice !== undefined) {
      query = query.gte("main_price->>price", params.minPrice.toString())
    }
    if (params.maxPrice !== undefined) {
      query = query.lte("main_price->>price", params.maxPrice.toString())
    }

    // Surface range
    if (params.minSurface !== undefined) {
      query = query.gte("surface", params.minSurface)
    }
    if (params.maxSurface !== undefined) {
      query = query.lte("surface", params.maxSurface)
    }

    // Tags filter (contains any of the specified tags)
    if (params.tags && params.tags.length > 0) {
      query = query.overlaps("tags", params.tags)
    }

    // Sorting: featured first, then by price desc
    query = query.order("featured", { ascending: false })
    query = query.order("main_price->>price", { ascending: false })

    // Pagination
    const limit = params.limit || 20
    const offset = params.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error("❌ Cache search error:", error)
      throw new Error(`Cache search failed: ${error.message}`)
    }

    console.log(`✅ Found ${data?.length || 0} cached properties (total: ${count})`)

    const transformedProperties = (data || []).map(this.transformCachedToProperty)

    return {
      properties: transformedProperties,
      total: count || 0,
      hasNext: offset + limit < (count || 0),
      hasPrevious: offset > 0,
    }
  }

  /**
   * FREE TIER OPTIMIZED: Sync with very small batches and delays
   */
  async syncPropertiesWithCheckpoint(
    limit = 50, // Reduced default limit
    processId?: string,
    resumeFromCheckpoint = true,
  ): Promise<{ synced: number; errors: number; processId: string }> {
    const actualProcessId = processId || `sync_${Date.now()}`
    console.log(`🔄 FREE TIER SYNC: Starting (ID: ${actualProcessId}, limit: ${limit})`)

    let synced = 0
    let errors = 0
    let offset = 0
    let currentBatch = 0
    const batchSize = 5 // VERY small batches for free tier
    const startTime = Date.now()

    try {
      // Check for existing checkpoint
      let checkpoint = null
      if (resumeFromCheckpoint) {
        checkpoint = await checkpointService.getCheckpoint("property_sync", actualProcessId)
        if (checkpoint && checkpoint.status === "running") {
          console.log(`📍 Resuming from checkpoint: ${checkpoint.processedItems}/${checkpoint.totalItems}`)
          synced = checkpoint.processedItems
          errors = checkpoint.failedItems
          offset = checkpoint.checkpointData.offset || 0
          currentBatch = checkpoint.currentBatch
        }
      }

      // Conservative total estimate for free tier
      const totalProperties = Math.min(limit, 200) // Cap at 200 for free tier

      // Create initial checkpoint
      await checkpointService.updateCheckpoint({
        processType: "property_sync",
        processId: actualProcessId,
        processedItems: synced,
        failedItems: errors,
        currentBatch,
        totalItems: totalProperties,
        checkpointData: { offset, batchSize, limit, startTime },
      })

      while (offset < limit) {
        const currentBatchSize = Math.min(batchSize, limit - offset)
        currentBatch++

        console.log(`📦 FREE TIER BATCH ${currentBatch}: ${offset + 1}-${offset + currentBatchSize}`)

        try {
          // Add delay between batches for free tier
          if (currentBatch > 1) {
            console.log("⏳ Free tier delay: 3 seconds...")
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }

          // Fetch from TokkoBroker with connection limiting
          const tokkoResponse = await withConnectionLimit(async () => {
            return await secureTokkoClient.getProperties({
              limit: currentBatchSize.toString(),
              offset: offset.toString(),
            })
          })

          if (!tokkoResponse.objects || tokkoResponse.objects.length === 0) {
            console.log("✅ No more properties to sync")
            break
          }

          // Process properties ONE BY ONE for free tier
          let batchSynced = 0
          let batchErrors = 0

          for (const tokkoProperty of tokkoResponse.objects) {
            try {
              await this.cachePropertyFreeTier(tokkoProperty)
              batchSynced++

              // Small delay between individual properties
              await new Promise((resolve) => setTimeout(resolve, 500))
            } catch (error) {
              console.error(`❌ Failed to cache property ${tokkoProperty.id}:`, error)
              batchErrors++
            }
          }

          synced += batchSynced
          errors += batchErrors
          offset += currentBatchSize

          // Update checkpoint after each batch
          await checkpointService.updateCheckpoint({
            processType: "property_sync",
            processId: actualProcessId,
            processedItems: synced,
            failedItems: errors,
            currentBatch,
            lastProcessedTokkoId: tokkoResponse.objects[tokkoResponse.objects.length - 1]?.id,
            checkpointData: { offset, batchSize, limit, startTime },
          })

          // Progress logging
          const progress = (synced / totalProperties) * 100
          console.log(`✅ FREE TIER PROGRESS: ${progress.toFixed(1)}% (${synced}/${totalProperties})`)

          // Break if we got fewer properties than requested
          if (tokkoResponse.objects.length < currentBatchSize) {
            console.log("✅ Reached end of available properties")
            break
          }
        } catch (batchError) {
          console.error(`❌ Batch ${currentBatch} failed:`, batchError)

          // Continue with next batch instead of failing completely
          offset += currentBatchSize
          errors += currentBatchSize

          // Longer delay after errors
          console.log("⏳ Error recovery delay: 10 seconds...")
          await new Promise((resolve) => setTimeout(resolve, 10000))
        }
      }

      // Complete checkpoint
      await checkpointService.completeCheckpoint("property_sync", actualProcessId, "completed")

      console.log(`✅ FREE TIER SYNC COMPLETED: ${synced} synced, ${errors} errors`)
      return { synced, errors, processId: actualProcessId }
    } catch (error) {
      console.error("❌ Free tier sync failed:", error)
      await checkpointService.completeCheckpoint("property_sync", actualProcessId, "failed")
      throw error
    }
  }

  /**
   * FREE TIER OPTIMIZED: Cache single property with connection limiting
   */
  private async cachePropertyFreeTier(tokkoProperty: any): Promise<void> {
    return await withConnectionLimit(async () => {
      const transformed = transformTokkoProperty(tokkoProperty)

      // Prepare minimal data for free tier
      const cacheData = {
        tokko_id: transformed.id,
        title: transformed.title,
        reference_code: transformed.referenceCode,
        description: transformed.description?.substring(0, 500), // Truncate for free tier
        rich_description: transformed.richDescription?.substring(0, 1000), // Truncate
        prices: transformed.prices,
        main_price: transformed.mainPrice,
        available_operations: transformed.availableOperations,
        surface: transformed.surface,
        covered_surface: transformed.coveredSurface,
        uncovered_surface: transformed.uncoveredSurface,
        total_surface: transformed.totalSurface,
        location_name: transformed.location.name,
        location_full: transformed.location.fullLocation,
        location_short: transformed.location.shortLocation,
        address: transformed.location.address,
        real_address: transformed.location.realAddress,
        coordinates:
          transformed.location.coordinates.lat && transformed.location.coordinates.lng
            ? `(${transformed.location.coordinates.lng},${transformed.location.coordinates.lat})`
            : null,
        property_type: transformed.type,
        property_type_code: transformed.typeCode,
        operation_type: transformed.operation,
        age: transformed.age,
        condition: transformed.condition,
        situation: transformed.situation,
        zonification: transformed.zonification,
        rooms: transformed.rooms,
        bathrooms: transformed.bathrooms,
        toilets: transformed.toilets,
        suites: transformed.suites,
        parking_spaces: transformed.parkingSpaces,
        floors: transformed.floors,
        orientation: transformed.features.orientation,
        amenities: transformed.features.amenities.slice(0, 10), // Limit amenities
        tags: transformed.features.amenities.slice(0, 5), // Limit tags
        extra_attributes: transformed.features.extraAttributes.slice(0, 5), // Limit attributes
        contact_info: transformed.contact,
        featured: transformed.featured,
        status: transformed.status,
        transaction_requirements: transformed.transactionRequirements,
        has_temporary_rent: transformed.hasTemporaryRent,
        expenses: transformed.expenses,
        public_url: transformed.publicUrl,
        tokko_created_at: transformed.createdAt,
        tokko_updated_at: transformed.createdAt,
        last_synced_at: new Date().toISOString(),
        sync_status: "synced",
      }

      const { data: propertyData, error: propertyError } = await supabaseAdmin
        .from("properties_cache")
        .upsert(cacheData, {
          onConflict: "tokko_id",
          ignoreDuplicates: false,
        })
        .select("id, tokko_id")
        .single()

      if (propertyError) {
        throw new Error(`Failed to cache property: ${propertyError.message}`)
      }

      if (!propertyData?.id) {
        throw new Error("Failed to get property ID after upsert")
      }

      // Cache only first 3 images for free tier
      if (transformed.images && transformed.images.length > 0) {
        await this.cachePropertyImagesFreeTier(propertyData.id, transformed.images.slice(0, 3))
      }
    })
  }

  /**
   * FREE TIER OPTIMIZED: Cache limited images
   */
  private async cachePropertyImagesFreeTier(
    propertyId: number,
    images: Array<{ url: string; description: string }>,
  ): Promise<void> {
    return await withConnectionLimit(async () => {
      const imageData = images.map((img, index) => ({
        property_id: propertyId,
        original_url: img.url,
        original_description: img.description?.substring(0, 100), // Truncate
        display_order: index,
        processing_status: "pending",
      }))

      const { error } = await supabaseAdmin.from("property_images").upsert(imageData, {
        onConflict: "property_id,original_url",
        ignoreDuplicates: true,
      })

      if (error) {
        console.error("❌ Failed to cache images:", error)
        // Don't throw - continue processing
      }
    })
  }

  /**
   * Get a single property from cache
   */
  async getProperty(id: number): Promise<TransformedProperty | null> {
    console.log(`🔍 Getting cached property ${id}`)

    const { data, error } = await supabase.from("properties_with_images").select("*").eq("tokko_id", id).single()

    if (error) {
      console.log(`❌ Property ${id} not found in cache:`, error.message)
      return null
    }

    return this.transformCachedToProperty(data)
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalProperties: number
    featuredProperties: number
    lastSyncTime: string | null
    pendingImages: number
    processedImages: number
  }> {
    const [
      { count: totalProperties },
      { count: featuredProperties },
      { data: lastSync },
      { count: pendingImages },
      { count: processedImages },
    ] = await Promise.all([
      supabase.from("properties_cache").select("*", { count: "exact", head: true }),
      supabase.from("properties_cache").select("*", { count: "exact", head: true }).eq("featured", true),
      supabase
        .from("properties_cache")
        .select("last_synced_at")
        .order("last_synced_at", { ascending: false })
        .limit(1)
        .single(),
      supabase.from("property_images").select("*", { count: "exact", head: true }).eq("processing_status", "pending"),
      supabase.from("property_images").select("*", { count: "exact", head: true }).eq("processing_status", "completed"),
    ])

    return {
      totalProperties: totalProperties || 0,
      featuredProperties: featuredProperties || 0,
      lastSyncTime: lastSync?.last_synced_at || null,
      pendingImages: pendingImages || 0,
      processedImages: processedImages || 0,
    }
  }

  /**
   * Transform cached property to TransformedProperty format
   */
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
        url: img.avif_url || img.webp_url || img.original_url,
        description: img.description || "",
      })),
      videos: [],
    }
  }
}

export const propertyCacheService = PropertyCacheService.getInstance()
