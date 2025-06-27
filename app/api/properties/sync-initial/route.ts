import { NextResponse } from "next/server"
import { sql } from "@/lib/neon-client"
import { secureTokkoClient } from "@/lib/enhanced-tokko-client"
import { transformTokkoProperty } from "@/lib/tokko-transformer"

export async function POST() {
  try {
    console.log("🚀 Starting property sync via API...")

    // Check if we already have properties
    const existingCount = await sql`SELECT COUNT(*) as count FROM properties_cache`

    if (existingCount[0].count > 10) {
      return NextResponse.json({
        success: true,
        message: "Properties already exist in database",
        count: existingCount[0].count,
      })
    }

    // Fetch properties from Tokko API
    const tokkoResponse = await secureTokkoClient.getProperties({
      limit: 20,
      offset: 0,
    })

    if (!tokkoResponse?.objects || tokkoResponse.objects.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No properties found from API",
        },
        { status: 404 },
      )
    }

    let synced = 0
    let errors = 0

    for (const tokkoProperty of tokkoResponse.objects) {
      try {
        const transformed = transformTokkoProperty(tokkoProperty)

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
            ${transformed.id}, ${transformed.title}, ${transformed.description}, 
            ${transformed.richDescription}, ${transformed.referenceCode}, 
            ${JSON.stringify(transformed.prices)}, ${JSON.stringify(transformed.mainPrice)}, 
            ${transformed.availableOperations}, ${transformed.surface}, ${transformed.coveredSurface},
            ${transformed.uncoveredSurface}, ${transformed.totalSurface}, ${transformed.location.name}, 
            ${transformed.location.fullLocation}, ${transformed.location.shortLocation}, 
            ${transformed.location.address}, ${transformed.location.realAddress}, 
            ${JSON.stringify(transformed.location.coordinates)}, ${transformed.type}, 
            ${transformed.typeCode}, ${transformed.operation}, ${transformed.age}, 
            ${transformed.condition}, ${transformed.situation}, ${transformed.zonification}, 
            ${transformed.rooms}, ${transformed.bathrooms}, ${transformed.toilets}, 
            ${transformed.suites}, ${transformed.parkingSpaces}, ${transformed.floors}, 
            ${transformed.features.orientation}, ${transformed.features.amenities}, 
            ${transformed.features.amenities}, ${JSON.stringify(transformed.features.extraAttributes)}, 
            ${JSON.stringify(transformed.contact)}, ${transformed.featured}, ${transformed.status}, 
            ${transformed.transactionRequirements}, ${transformed.hasTemporaryRent}, 
            ${transformed.expenses}, ${transformed.publicUrl}, ${transformed.createdAt}, 
            ${transformed.createdAt}, 'synced', NOW(), NOW()
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

        synced++
      } catch (error: any) {
        errors++
        console.error(`Failed to sync property ${tokkoProperty.id}:`, error.message)
      }
    }

    const finalCount = await sql`SELECT COUNT(*) as count FROM properties_cache`

    return NextResponse.json({
      success: true,
      message: `Sync completed: ${synced} properties synced, ${errors} errors`,
      synced,
      errors,
      total: finalCount[0].count,
    })
  } catch (error: any) {
    console.error("Sync API error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Sync failed",
        error: error.message,
      },
      { status: 500 },
    )
  }
}
