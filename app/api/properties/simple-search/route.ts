import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "12")
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const operation = searchParams.get("operation")
    const minSurface = searchParams.get("minSurface")
    const maxSurface = searchParams.get("maxSurface")
    const featured = searchParams.get("featured") === "true"

    console.log("🔍 Simple search API called with:", {
      page,
      limit,
      search,
      type: type ? `${type} (converted to ${Number.parseInt(type)})` : null,
      operation,
      minSurface,
      maxSurface,
      featured,
    })

    // Create Neon client
    const sql = neon(process.env.DATABASE_URL!)

    // Build WHERE conditions with proper parameter binding
    const whereConditions: string[] = []
    const bindValues: any[] = []

    // Apply filters
    if (search) {
      whereConditions.push(
        `(title ILIKE '%${search}%' OR description ILIKE '%${search}%' OR location_name ILIKE '%${search}%')`,
      )
    }

    if (type) {
      // Map numeric IDs to actual codes in database
      const typeCodeMap: Record<string, string> = {
        "12": "IS", // Industrial Ship -> Nave Industrial
        "24": "GL", // Warehouse -> Galpón
        "14": "ST", // Storage -> Depósito
        "27": "IL", // Industrial Land -> Terreno Industrial
        "5": "OF", // Office -> Oficina
        "7": "LO", // Business Premises -> Local Comercial
        "1": "LA", // Land -> Terreno
        "2": "AP", // Apartment -> Departamento
        "13": "PH", // Condo -> PH
        "3": "HO", // House -> Casa
        "26": "CL", // Commercial Land -> Terreno Comercial
      }

      const actualCode = typeCodeMap[type] || type
      console.log(`🔍 Filtering by type: ${type} -> ${actualCode}`)
      whereConditions.push(`property_type_code = '${actualCode}'`)
    }

    if (operation) {
      whereConditions.push(`operation_type = '${operation}'`)
    }

    if (minSurface) {
      whereConditions.push(`surface >= ${Number.parseInt(minSurface)}`)
    }

    if (maxSurface) {
      whereConditions.push(`surface <= ${Number.parseInt(maxSurface)}`)
    }

    if (featured) {
      whereConditions.push(`featured = true`)
    }

    // Build pagination
    const offset = (page - 1) * limit

    // Execute count query
    const countQuery =
      whereConditions.length > 0
        ? sql`SELECT COUNT(*) as total FROM properties_cache WHERE ${sql.raw(whereConditions.join(" AND "))}`
        : sql`SELECT COUNT(*) as total FROM properties_cache`

    const countResult = await countQuery
    const total = Number.parseInt(countResult[0]?.total || "0")

    // Execute main query with dynamic WHERE clause
    let mainQuery
    if (whereConditions.length > 0) {
      mainQuery = sql`
    SELECT * FROM properties_cache 
    WHERE ${sql.raw(whereConditions.join(" AND "))}
    ORDER BY featured DESC, updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
    } else {
      mainQuery = sql`
    SELECT * FROM properties_cache 
    ORDER BY featured DESC, updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
    }

    const data = await mainQuery

    console.log(`✅ Found ${data?.length || 0} properties (total: ${total})`)

    return NextResponse.json({
      properties: data || [],
      total: total || 0,
    })
  } catch (error: any) {
    console.error("❌ Simple search API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
