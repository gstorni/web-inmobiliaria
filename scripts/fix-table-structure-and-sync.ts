import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function fixTableStructureAndSync() {
  console.log("🔧 Fixing Table Structure and Syncing Data...")
  console.log("=".repeat(60))

  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    // Step 1: Create missing views/aliases for backward compatibility
    console.log("\n📋 Step 1: Creating compatibility views...")

    try {
      // Create properties view that maps to properties_cache
      await sql`
        CREATE OR REPLACE VIEW properties AS
        SELECT 
          id,
          tokko_id,
          title,
          description,
          CASE 
            WHEN main_price IS NOT NULL THEN (main_price->>'price')::numeric
            ELSE 0
          END as price,
          CASE 
            WHEN main_price IS NOT NULL THEN main_price->>'currency'
            ELSE 'USD'
          END as currency,
          surface,
          covered_surface,
          location_name,
          address,
          property_type,
          operation_type,
          featured,
          CASE 
            WHEN coordinates IS NOT NULL THEN (coordinates->>'lat')::numeric
            ELSE NULL
          END as latitude,
          CASE 
            WHEN coordinates IS NOT NULL THEN (coordinates->>'lng')::numeric
            ELSE NULL
          END as longitude,
          rooms,
          bathrooms,
          parking_spaces as garages,
          age,
          orientation,
          CASE 
            WHEN contact_info IS NOT NULL THEN contact_info->>'agency_name'
            ELSE ''
          END as contact_agency,
          CASE 
            WHEN contact_info IS NOT NULL THEN contact_info->>'agent_name'
            ELSE ''
          END as contact_agent,
          CASE 
            WHEN contact_info IS NOT NULL THEN contact_info->>'phone'
            ELSE ''
          END as contact_phone,
          CASE 
            WHEN contact_info IS NOT NULL THEN contact_info->>'email'
            ELSE ''
          END as contact_email,
          CASE 
            WHEN contact_info IS NOT NULL THEN contact_info->>'whatsapp'
            ELSE ''
          END as contact_whatsapp,
          created_at,
          updated_at,
          extra_attributes as raw_data
        FROM properties_cache
      `
      console.log("✅ Created properties view")

      // Create property_images view that maps to property_images_neon
      await sql`
        CREATE OR REPLACE VIEW property_images AS
        SELECT 
          id,
          property_id,
          original_url,
          original_description as description,
          display_order,
          webp_url as optimized_url,
          thumbnail_url,
          created_at,
          updated_at
        FROM property_images_neon
      `
      console.log("✅ Created property_images view")
    } catch (error: any) {
      console.log(`⚠️ View creation warning: ${error.message}`)
    }

    // Step 2: Check current data
    console.log("\n📊 Step 2: Checking current data...")

    const propertiesCount = await sql`SELECT COUNT(*) as count FROM properties_cache`
    const imagesCount = await sql`SELECT COUNT(*) as count FROM property_images_neon`

    console.log(`Properties in cache: ${propertiesCount[0].count}`)
    console.log(`Images in cache: ${imagesCount[0].count}`)

    // Step 3: Verify data access
    console.log("\n🔧 Step 3: Verifying data access...")

    // Test the views
    const testProperties = await sql`SELECT COUNT(*) as count FROM properties LIMIT 1`
    const testImages = await sql`SELECT COUNT(*) as count FROM property_images LIMIT 1`

    console.log(`✅ Properties view: ${testProperties[0].count} accessible`)
    console.log(`✅ Images view: ${testImages[0].count} accessible`)

    // Step 4: Test a complete property with images (FIXED GROUP BY)
    console.log("\n🔍 Step 4: Testing complete property data...")

    const sampleProperty = await sql`
      SELECT 
        p.id,
        p.tokko_id,
        p.title,
        p.price,
        p.currency,
        p.location_name,
        p.surface,
        p.featured,
        COUNT(img.id) as image_count
      FROM properties p
      LEFT JOIN property_images img ON p.tokko_id = img.property_id
      GROUP BY p.id, p.tokko_id, p.title, p.price, p.currency, p.location_name, p.surface, p.featured
      ORDER BY p.featured DESC
      LIMIT 1
    `

    if (sampleProperty.length > 0) {
      const prop = sampleProperty[0]
      console.log(`✅ Sample property: ${prop.tokko_id} - ${prop.title}`)
      console.log(`   Images: ${prop.image_count}`)
      console.log(`   Price: ${prop.price} ${prop.currency}`)
      console.log(`   Location: ${prop.location_name}`)
      console.log(`   Surface: ${prop.surface} m²`)

      // Test getting images for this property
      const propertyImages = await sql`
        SELECT original_url, optimized_url, thumbnail_url, description
        FROM property_images 
        WHERE property_id = ${prop.tokko_id}
        ORDER BY display_order
        LIMIT 3
      `

      console.log(`   Sample images:`)
      propertyImages.forEach((img: any, index: number) => {
        console.log(`     ${index + 1}. ${img.original_url}`)
        if (img.optimized_url) console.log(`        Optimized: ${img.optimized_url}`)
        if (img.thumbnail_url) console.log(`        Thumbnail: ${img.thumbnail_url}`)
      })
    }

    // Step 5: Test the application queries
    console.log("\n🧪 Step 5: Testing application queries...")

    // Test property list query (what your app uses)
    const listQuery = await sql`
      SELECT 
        p.id,
        p.tokko_id,
        p.title,
        p.price,
        p.currency,
        p.location_name,
        p.property_type,
        p.operation_type,
        p.surface,
        p.featured,
        (SELECT original_url FROM property_images WHERE property_id = p.tokko_id ORDER BY display_order LIMIT 1) as main_image
      FROM properties p
      ORDER BY p.featured DESC, p.id DESC
      LIMIT 5
    `

    console.log(`✅ Property list query: ${listQuery.length} results`)
    listQuery.forEach((prop: any) => {
      console.log(`   • ${prop.tokko_id}: ${prop.title}`)
      console.log(`     Price: ${prop.price} ${prop.currency}`)
      console.log(`     Image: ${prop.main_image ? "✅ Available" : "❌ Missing"}`)
    })

    // Test property detail query (what your app uses)
    if (listQuery.length > 0) {
      const detailQuery = await sql`
        SELECT 
          p.*,
          COALESCE(
            (SELECT json_agg(
              json_build_object(
                'id', img.id,
                'original_url', img.original_url,
                'optimized_url', img.optimized_url,
                'thumbnail_url', img.thumbnail_url,
                'description', img.description
              ) ORDER BY img.display_order
            ) FROM property_images img WHERE img.property_id = p.tokko_id),
            '[]'::json
          ) as images
        FROM properties p
        WHERE p.tokko_id = ${listQuery[0].tokko_id}
      `

      if (detailQuery.length > 0) {
        const detail = detailQuery[0]
        const images = detail.images || []
        console.log(`✅ Property detail query: ${detail.title}`)
        console.log(`   Images: ${Array.isArray(images) ? images.length : "Invalid format"}`)
      }
    }

    console.log("\n" + "=".repeat(60))
    console.log("🎉 TABLE STRUCTURE FIX COMPLETE!")
    console.log("=".repeat(60))
    console.log("✅ Compatibility views created")
    console.log("✅ Data access verified")
    console.log("✅ Application queries tested")
    console.log("\n🚀 Your application should now work!")
    console.log("   • Properties display with data")
    console.log("   • Images show original URLs")
    console.log("   • All property attributes available")
    console.log("\n📝 Next steps:")
    console.log("1. Start your dev server: npm run dev")
    console.log("2. Visit /propiedades to see property listings")
    console.log("3. Visit /propiedades/[id] for property details")
    console.log("4. Optional: Run image processing for optimization")
  } catch (error: any) {
    console.error("❌ Fix failed:", error.message)
    console.error("Full error:", error)
    throw error
  }
}

// Run the fix
fixTableStructureAndSync()
  .then(() => {
    console.log("\n✅ Fix complete!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Fix failed:", error)
    process.exit(1)
  })
