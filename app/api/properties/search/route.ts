import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/neon-client"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "12")))
    const offset = (page - 1) * limit

    // Parse filters
    const query = searchParams.get("query")
    const type = searchParams.get("type")
    const operation = searchParams.get("operation")
    const minPrice = searchParams.get("minPrice")
    const maxPrice = searchParams.get("maxPrice")
    const minSurface = searchParams.get("minSurface")
    const maxSurface = searchParams.get("maxSurface")
    const featured = searchParams.get("featured")

    console.log(`🔍 Property search - Page: ${page}, Limit: ${limit}`)
    console.log(`🔍 Filters:`, { query, type, operation, minPrice, maxPrice, minSurface, maxSurface, featured })

    // Build WHERE conditions
    const conditions = ["pc.sync_status = 'synced'"]
    const params: any[] = []
    let paramIndex = 1

    if (query) {
      conditions.push(`(
        pc.title ILIKE $${paramIndex} OR 
        pc.description ILIKE $${paramIndex} OR 
        pc.location_name ILIKE $${paramIndex} OR
        pc.address ILIKE $${paramIndex}
      )`)
      params.push(`%${query}%`)
      paramIndex++
    }

    if (type) {
      conditions.push(`pc.property_type_code = $${paramIndex}`)
      params.push(type)
      paramIndex++
    }

    if (operation) {
      conditions.push(`pc.operation_type = $${paramIndex}`)
      params.push(operation)
      paramIndex++
    }

    if (featured === "true") {
      conditions.push(`pc.featured = true`)
    }

    if (minPrice) {
      conditions.push(`(pc.main_price->>'price')::numeric >= $${paramIndex}`)
      params.push(Number.parseFloat(minPrice))
      paramIndex++
    }

    if (maxPrice) {
      conditions.push(`(pc.main_price->>'price')::numeric <= $${paramIndex}`)
      params.push(Number.parseFloat(maxPrice))
      paramIndex++
    }

    if (minSurface) {
      conditions.push(`pc.surface >= $${paramIndex}`)
      params.push(Number.parseFloat(minSurface))
      paramIndex++
    }

    if (maxSurface) {
      conditions.push(`pc.surface <= $${paramIndex}`)
      params.push(Number.parseFloat(maxSurface))
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM properties_cache pc
      ${whereClause}
    `

    const countResult = await sql.unsafe(countQuery, params)
    const total = Number.parseInt(countResult[0]?.total || "0")

    // Get properties with images
    const propertiesQuery = `
      SELECT 
        pc.*,
        COALESCE(
          json_agg(
            json_build_object(
              'original_url', pi.original_url,
              'optimized_url', COALESCE(pi.webp_url, pi.original_url),
              'thumbnail_url', COALESCE(pi.thumbnail_url, pi.webp_url, pi.original_url),
              'description', pi.original_description
            ) ORDER BY pi.display_order
          ) FILTER (WHERE pi.id IS NOT NULL), 
          '[]'::json
        ) as images
      FROM properties_cache pc
      LEFT JOIN property_images_neon pi ON pc.tokko_id = pi.property_id
      ${whereClause}
      GROUP BY pc.id
      ORDER BY pc.featured DESC, pc.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    params.push(limit, offset)
    const properties = await sql.unsafe(propertiesQuery, params)

    // Transform properties to match expected format
    const transformedProperties = (properties || []).map((prop: any) => ({
      id: prop.id,
      tokko_id: prop.tokko_id,
      title: prop.title,
      reference_code: prop.reference_code,
      description: prop.description,
      location_name: prop.location_name,
      address: prop.address,
      price: prop.main_price?.price || 0,
      currency: prop.main_price?.currency || "USD",
      surface: prop.surface || 0,
      property_type: prop.property_type,
      property_type_code: prop.property_type_code,
      operation_type: prop.operation_type,
      featured: prop.featured || false,
      rooms: prop.rooms || 0,
      bathrooms: prop.bathrooms || 0,
      parking_spaces: prop.parking_spaces || 0,
      images: prop.images || [],
    }))

    const totalPages = Math.ceil(total / limit)

    console.log(`✅ Found ${transformedProperties.length} properties (${total} total)`)

    return NextResponse.json({
      properties: transformedProperties,
      total,
      page,
      limit,
      totalPages,
    })
  } catch (error: any) {
    console.error("❌ Properties search error:", error)
    return NextResponse.json(
      {
        error: "Failed to search properties",
        details: error.message,
        properties: [],
        total: 0,
      },
      { status: 500 },
    )
  }
}
