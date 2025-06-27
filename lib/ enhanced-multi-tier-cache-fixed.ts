import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

interface CacheStats {
  redisHits: number
  redisMisses: number
  neonHits: number
  neonMisses: number
  apiCalls: number
  totalRequests: number
}

interface PropertyWithImages {
  id: number
  tokko_id: number
  title: string
  description: string
  price: number
  currency: string
  surface: number
  location_name: string
  address: string
  property_type: string
  operation_type: string
  featured: boolean
  latitude?: number
  longitude?: number
  images: Array<{
    id: string
    original_url: string
    optimized_url?: string
    thumbnail_url?: string
    description?: string
  }>
  contact_info?: any
  created_at: string
  updated_at: string
}

export class EnhancedMultiTierCache {
  private static instance: EnhancedMultiTierCache
  private stats: CacheStats = {
    redisHits: 0,
    redisMisses: 0,
    neonHits: 0,
    neonMisses: 0,
    apiCalls: 0,
    totalRequests: 0,
  }

  static getInstance(): EnhancedMultiTierCache {
    if (!EnhancedMultiTierCache.instance) {
      EnhancedMultiTierCache.instance = new EnhancedMultiTierCache()
    }
    return EnhancedMultiTierCache.instance
  }

  async getProperty(tokkoId: number): Promise<PropertyWithImages | null> {
    this.stats.totalRequests++
    const startTime = Date.now()

    try {
      console.log(`🔍 Fetching property ${tokkoId}...`)

      // Tier 2: Check Neon Database (using views for compatibility)
      const neonResult = await sql`
        SELECT p.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', img.id,
                     'original_url', img.original_url,
                     'optimized_url', img.optimized_url,
                     'thumbnail_url', img.thumbnail_url,
                     'description', img.description
                   ) ORDER BY img.display_order
                 ) FILTER (WHERE img.id IS NOT NULL),
                 '[]'::json
               ) AS images
        FROM properties p
        LEFT JOIN property_images img ON p.tokko_id = img.property_id
        WHERE p.tokko_id = ${tokkoId}
        GROUP BY p.id
      `

      if (neonResult.length > 0) {
        this.stats.neonHits++
        const property = neonResult[0]

        console.log(`✅ Found in Neon DB (${Date.now() - startTime}ms)`)
        console.log(`   Images: ${JSON.parse(property.images).length}`)

        return {
          ...property,
          images: JSON.parse(property.images),
        }
      }

      this.stats.neonMisses++
      console.log(`⚪ Not found in Neon DB`)

      // Tier 3: Fallback to API
      console.log(`📡 Fetching from API...`)
      this.stats.apiCalls++

      const { createSecureTokkoClient } = await import("./enhanced-tokko-client-fixed")
      const client = createSecureTokkoClient()

      const apiResponse = await client.getProperty(tokkoId)

      if (apiResponse.object) {
        const property = apiResponse.object
        console.log(`✅ Found in API (${Date.now() - startTime}ms)`)

        // Transform and cache in Neon
        await this.cachePropertyInNeon(property)

        return this.transformApiProperty(property)
      }

      console.log(`❌ Property ${tokkoId} not found anywhere`)
      return null
    } catch (error: any) {
      console.error(`❌ Error fetching property ${tokkoId}:`, error.message)
      return null
    }
  }

  async searchProperties(filters: any = {}): Promise<PropertyWithImages[]> {
    this.stats.totalRequests++
    const startTime = Date.now()

    try {
      console.log(`🔍 Searching properties with filters:`, filters)

      // Build query based on filters
      let whereClause = "WHERE 1=1"
      const params: any[] = []

      if (filters.type) {
        whereClause += ` AND p.property_type ILIKE $${params.length + 1}`
        params.push(`%${filters.type}%`)
      }

      if (filters.operation) {
        whereClause += ` AND p.operation_type ILIKE $${params.length + 1}`
        params.push(`%${filters.operation}%`)
      }

      if (filters.minPrice) {
        whereClause += ` AND p.price >= $${params.length + 1}`
        params.push(Number(filters.minPrice))
      }

      if (filters.maxPrice) {
        whereClause += ` AND p.price <= $${params.length + 1}`
        params.push(Number(filters.maxPrice))
      }

      const limit = Math.min(Number(filters.limit) || 20, 100)
      const offset = Number(filters.offset) || 0

      // Use raw query for complex filtering
      const query = `
        SELECT p.*, 
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', img.id,
                     'original_url', img.original_url,
                     'optimized_url', img.optimized_url,
                     'thumbnail_url', img.thumbnail_url,
                     'description', img.description
                   ) ORDER BY img.display_order
                 ) FILTER (WHERE img.id IS NOT NULL),
                 '[]'::json
               ) AS images
        FROM properties p
        LEFT JOIN property_images img ON p.tokko_id = img.property_id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.featured DESC, p.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `

      const results = await sql.unsafe(query, params)

      console.log(`✅ Found ${results.length} properties in Neon DB (${Date.now() - startTime}ms)`)

      return results.map((property: any) => ({
        ...property,
        images: JSON.parse(property.images),
      }))
    } catch (error: any) {
      console.error(`❌ Error searching properties:`, error.message)
      return []
    }
  }

  private async cachePropertyInNeon(property: any): Promise<void> {
    try {
      // Transform and insert property
      const mainPrice = property.price
        ? {
            price: property.price,
            currency: property.currency || "USD",
            operation: property.operation_type || "Venta",
          }
        : null

      const coordinates =
        property.geo_lat && property.geo_long
          ? {
              lat: property.geo_lat,
              lng: property.geo_long,
            }
          : null

      const contactInfo = {
        agency_name: property.real_estate_agency?.name || "",
        agent_name: property.publisher?.name || "",
        phone: property.real_estate_agency?.phone || "",
        email: property.real_estate_agency?.email || "",
        whatsapp: property.real_estate_agency?.whatsapp || "",
      }

      // Insert or update property
      await sql`
        INSERT INTO properties_cache (
          tokko_id, title, description, main_price, surface, covered_surface,
          location_name, address, property_type, operation_type, featured,
          coordinates, rooms, bathrooms, parking_spaces, age, orientation,
          contact_info, extra_attributes, created_at, updated_at
        ) VALUES (
          ${property.id},
          ${property.publication_title || property.type?.name || "Propiedad Industrial"},
          ${property.description || ""},
          ${mainPrice ? JSON.stringify(mainPrice) : null},
          ${property.surface || 0},
          ${property.roofed_surface || 0},
          ${property.location?.name || ""},
          ${property.address || ""},
          ${property.type?.name || "Industrial"},
          ${property.operation_type || "Venta"},
          ${property.is_starred || false},
          ${coordinates ? JSON.stringify(coordinates) : null},
          ${property.rooms || 0},
          ${property.bathrooms || 0},
          ${property.garages || 0},
          ${property.age || 0},
          ${property.orientation || ""},
          ${JSON.stringify(contactInfo)},
          ${JSON.stringify(property)},
          ${new Date().toISOString()},
          ${new Date().toISOString()}
        )
        ON CONFLICT (tokko_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          main_price = EXCLUDED.main_price,
          updated_at = EXCLUDED.updated_at
      `

      // Insert images
      if (property.photos && property.photos.length > 0) {
        for (let i = 0; i < property.photos.length; i++) {
          const photo = property.photos[i]
          await sql`
            INSERT INTO property_images_neon (
              property_id, original_url, original_description, display_order,
              processing_status, created_at, updated_at
            ) VALUES (
              ${property.id},
              ${photo.image},
              ${photo.description || ""},
              ${i + 1},
              'pending',
              ${new Date().toISOString()},
              ${new Date().toISOString()}
            )
            ON CONFLICT (property_id, original_url) DO NOTHING
          `
        }
      }

      console.log(`✅ Cached property ${property.id} in Neon`)
    } catch (error: any) {
      console.error(`❌ Error caching property ${property.id}:`, error.message)
    }
  }

  private transformApiProperty(property: any): PropertyWithImages {
    return {
      id: property.id,
      tokko_id: property.id,
      title: property.publication_title || property.type?.name || "Propiedad Industrial",
      description: property.description || "",
      price: property.price || 0,
      currency: property.currency || "USD",
      surface: property.surface || 0,
      location_name: property.location?.name || "",
      address: property.address || "",
      property_type: property.type?.name || "Industrial",
      operation_type: property.operation_type || "Venta",
      featured: property.is_starred || false,
      latitude: property.geo_lat,
      longitude: property.geo_long,
      images: (property.photos || []).map((photo: any, index: number) => ({
        id: `api-${property.id}-${index}`,
        original_url: photo.image,
        description: photo.description || "",
      })),
      contact_info: {
        agency_name: property.real_estate_agency?.name || "",
        agent_name: property.publisher?.name || "",
        phone: property.real_estate_agency?.phone || "",
        email: property.real_estate_agency?.email || "",
        whatsapp: property.real_estate_agency?.whatsapp || "",
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  resetStats(): void {
    this.stats = {
      redisHits: 0,
      redisMisses: 0,
      neonHits: 0,
      neonMisses: 0,
      apiCalls: 0,
      totalRequests: 0,
    }
  }
}

export const enhancedCache = EnhancedMultiTierCache.getInstance()
