import { sql } from "../lib/neon-client"
import { secureTokkoClient } from "../lib/enhanced-tokko-client"
import { transformTokkoProperty } from "../lib/tokko-transformer"

async function syncInitialProperties() {
  console.log("🚀 Starting initial property sync...")

  // Check environment variables
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set")
    console.log("💡 Please set your DATABASE_URL in .env.local:")
    console.log("DATABASE_URL=postgresql://username:password@host:port/database")
    process.exit(1)
  }

  if (!process.env.TOKKO_API_KEY) {
    console.error("❌ TOKKO_API_KEY environment variable is not set")
    console.log("💡 Please set your TOKKO_API_KEY in .env.local:")
    console.log("TOKKO_API_KEY=your_tokko_api_key_here")
    process.exit(1)
  }

  try {
    // Check if we already have properties
    console.log("📊 Checking existing properties...")
    const existingCount = await sql`SELECT COUNT(*) as count FROM properties_cache`
    console.log(`📊 Current properties in database: ${existingCount[0].count}`)

    if (existingCount[0].count > 10) {
      console.log("✅ Database already has properties, skipping sync")
      console.log("💡 To force sync, delete existing properties first")
      return
    }

    // Fetch properties from Tokko API
    console.log("📡 Fetching properties from Tokko API...")

    const tokkoResponse = await secureTokkoClient.getProperties({
      limit: 30,
      offset: 0,
    })

    if (!tokkoResponse?.objects || tokkoResponse.objects.length === 0) {
      console.log("❌ No properties found from API")
      console.log("💡 Check your TOKKO_API_KEY and API access")
      return
    }

    console.log(`✅ Found ${tokkoResponse.objects.length} properties from API`)

    let synced = 0
    let errors = 0

    for (const tokkoProperty of tokkoResponse.objects) {
      try {
        console.log(`🔄 Processing property ${tokkoProperty.id}...`)

        // Transform the property
        const transformed = transformTokkoProperty(tokkoProperty)

        // Store in database
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

        // Process images if they exist
        if (transformed.images && transformed.images.length > 0) {
          for (let i = 0; i < transformed.images.length; i++) {
            const image = transformed.images[i]
            try {
              await sql`
                INSERT INTO property_images_neon (
                  property_id, original_url, original_description, display_order,
                  webp_url, avif_url, thumbnail_url, processed_at, processing_status
                ) VALUES (
                  ${transformed.id}, ${image.url}, ${image.description || ""}, ${i + 1},
                  ${image.url}, ${image.url}, ${image.url}, NOW(), 'completed'
                )
                ON CONFLICT (property_id, original_url) DO UPDATE SET
                  display_order = EXCLUDED.display_order,
                  processed_at = NOW()
              `
            } catch (imageError) {
              console.warn(`⚠️ Failed to store image for property ${transformed.id}:`, imageError)
            }
          }
        }

        synced++
        console.log(`✅ Synced property ${transformed.id}: ${transformed.title}`)
      } catch (error: any) {
        errors++
        console.error(`❌ Failed to sync property ${tokkoProperty.id}:`, error.message)
      }
    }

    console.log(`\n🎉 Sync completed!`)
    console.log(`✅ Successfully synced: ${synced} properties`)
    console.log(`❌ Errors: ${errors} properties`)

    // Get final count
    const finalCount = await sql`SELECT COUNT(*) as count FROM properties_cache`
    console.log(`📊 Total properties in database: ${finalCount[0].count}`)

    console.log(`\n🌐 Next steps:`)
    console.log(`1. Visit http://localhost:3000/propiedades to see your properties`)
    console.log(`2. Visit http://localhost:3000/cache-management to monitor cache performance`)
    console.log(`3. Test property detail pages by clicking on any property`)
  } catch (error: any) {
    console.error("❌ Sync failed:", error.message)

    if (error.message.includes("database connection string")) {
      console.log("\n💡 Database connection issue:")
      console.log("1. Check your DATABASE_URL in .env.local")
      console.log("2. Make sure your Neon database is running")
      console.log("3. Verify your database credentials")
    }

    process.exit(1)
  }
}

// Run the sync
syncInitialProperties()
  .then(() => {
    console.log("🏁 Sync process completed successfully!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 Sync process failed:", error.message)
    process.exit(1)
  })
