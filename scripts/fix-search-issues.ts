import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

async function fixSearchIssues() {
  console.log("🔧 Search Issues Fix Tool")
  console.log("=".repeat(40))

  try {
    // 1. Check if properties_with_images view exists
    console.log("\n1️⃣ Checking properties_with_images view...")

    try {
      const { data, error } = await supabase
        .from("properties_with_images")
        .select("count", { count: "exact", head: true })

      if (error) {
        console.log("❌ View doesn't exist, creating it...")
        await createPropertiesWithImagesView()
      } else {
        console.log(`✅ View exists with ${data || 0} properties`)
      }
    } catch (error) {
      console.log("❌ View check failed, creating it...")
      await createPropertiesWithImagesView()
    }

    // 2. Check properties_cache table
    console.log("\n2️⃣ Checking properties_cache table...")

    const {
      data: cacheData,
      error: cacheError,
      count,
    } = await supabase.from("properties_cache").select("*", { count: "exact" }).limit(1)

    if (cacheError) {
      console.log("❌ properties_cache table issue:", cacheError.message)
      return
    }

    console.log(`✅ properties_cache table has ${count} properties`)

    if (count === 0) {
      console.log("⚠️ No properties in cache! You need to run sync.")
      console.log("Run: npx tsx scripts/warm-redis-cache.ts")
      return
    }

    // 3. Test search functionality
    console.log("\n3️⃣ Testing search functionality...")

    const testQueries = [
      { name: "All properties", query: {} },
      { name: "Type filter", query: { property_type_code: "12" } },
      { name: "Operation filter", query: { operation_type: "Venta" } },
    ]

    for (const test of testQueries) {
      try {
        let query = supabase.from("properties_with_images").select("*", { count: "exact" })

        Object.entries(test.query).forEach(([key, value]) => {
          query = query.eq(key, value)
        })

        const { data, error, count: testCount } = await query.limit(3)

        if (error) {
          console.log(`❌ ${test.name} failed:`, error.message)
        } else {
          console.log(`✅ ${test.name}: ${testCount} properties found`)
        }
      } catch (error) {
        console.log(`❌ ${test.name} error:`, error.message)
      }
    }

    // 4. Check search vector
    console.log("\n4️⃣ Checking search vector...")

    try {
      const { data: vectorData, error: vectorError } = await supabase
        .from("properties_cache")
        .select("search_vector")
        .not("search_vector", "is", null)
        .limit(1)

      if (vectorError || !vectorData || vectorData.length === 0) {
        console.log("❌ Search vector missing, updating...")
        await updateSearchVector()
      } else {
        console.log("✅ Search vector exists")
      }
    } catch (error) {
      console.log("❌ Search vector check failed:", error.message)
    }

    console.log("\n✅ Search issues diagnosis complete!")
  } catch (error) {
    console.error("❌ Fix failed:", error.message)
  }
}

async function createPropertiesWithImagesView() {
  if (!supabaseAdmin) {
    console.log("❌ Admin client not available")
    return
  }

  const createViewSQL = `
    CREATE OR REPLACE VIEW properties_with_images AS
    SELECT 
      pc.*,
      COALESCE(
        json_agg(
          json_build_object(
            'original_url', pi.original_url,
            'webp_url', pi.webp_url,
            'avif_url', pi.avif_url,
            'description', pi.original_description,
            'display_order', pi.display_order
          ) ORDER BY pi.display_order
        ) FILTER (WHERE pi.id IS NOT NULL),
        '[]'::json
      ) as images
    FROM properties_cache pc
    LEFT JOIN property_images pi ON pc.tokko_id = pi.property_id
    GROUP BY pc.id, pc.tokko_id, pc.title, pc.reference_code, pc.description, 
             pc.rich_description, pc.prices, pc.main_price, pc.available_operations,
             pc.surface, pc.covered_surface, pc.uncovered_surface, pc.total_surface,
             pc.location_name, pc.location_full, pc.location_short, pc.address,
             pc.real_address, pc.coordinates, pc.property_type, pc.property_type_code,
             pc.operation_type, pc.age, pc.condition, pc.situation, pc.zonification,
             pc.rooms, pc.bathrooms, pc.toilets, pc.suites, pc.parking_spaces,
             pc.floors, pc.orientation, pc.amenities, pc.tags, pc.extra_attributes,
             pc.contact_info, pc.featured, pc.status, pc.transaction_requirements,
             pc.has_temporary_rent, pc.expenses, pc.public_url, pc.tokko_created_at,
             pc.tokko_updated_at, pc.cached_at, pc.last_synced_at, pc.sync_status,
             pc.created_at, pc.updated_at, pc.search_vector;
  `

  try {
    const { error } = await supabaseAdmin.rpc("exec_sql", { sql: createViewSQL })

    if (error) {
      console.log("❌ Failed to create view:", error.message)
    } else {
      console.log("✅ properties_with_images view created")
    }
  } catch (error) {
    console.log("❌ View creation error:", error.message)
  }
}

async function updateSearchVector() {
  if (!supabaseAdmin) {
    console.log("❌ Admin client not available")
    return
  }

  const updateSQL = `
    UPDATE properties_cache 
    SET search_vector = to_tsvector('spanish', 
      COALESCE(title, '') || ' ' || 
      COALESCE(description, '') || ' ' || 
      COALESCE(location_name, '') || ' ' ||
      COALESCE(property_type, '')
    )
    WHERE search_vector IS NULL;
  `

  try {
    const { error } = await supabaseAdmin.rpc("exec_sql", { sql: updateSQL })

    if (error) {
      console.log("❌ Failed to update search vector:", error.message)
    } else {
      console.log("✅ Search vector updated")
    }
  } catch (error) {
    console.log("❌ Search vector update error:", error.message)
  }
}

fixSearchIssues().catch(console.error)
