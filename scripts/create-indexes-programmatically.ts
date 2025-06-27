import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const supabaseUrl = null
const supabaseServiceKey = null

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables")
  console.log("Required variables:")
  console.log("- NEXT_PUBLIC_SUPABASE_URL")
  console.log("- SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const indexes = [
  {
    name: "idx_properties_type_operation",
    sql: `CREATE INDEX IF NOT EXISTS idx_properties_type_operation 
          ON properties_cache (property_type_code, operation_type) 
          WHERE status = 1`,
  },
  {
    name: "idx_properties_location_gin",
    sql: `CREATE INDEX IF NOT EXISTS idx_properties_location_gin 
          ON properties_cache USING gin(to_tsvector('spanish', location_name))`,
  },
  {
    name: "idx_properties_price_range",
    sql: `CREATE INDEX IF NOT EXISTS idx_properties_price_range 
          ON properties_cache USING btree(((main_price->>'price')::numeric))`,
  },
  {
    name: "idx_properties_featured_updated",
    sql: `CREATE INDEX IF NOT EXISTS idx_properties_featured_updated 
          ON properties_cache (featured DESC, updated_at DESC) 
          WHERE status = 1`,
  },
  {
    name: "idx_properties_search_composite",
    sql: `CREATE INDEX IF NOT EXISTS idx_properties_search_composite 
          ON properties_cache (property_type_code, operation_type, featured DESC, updated_at DESC)`,
  },
  {
    name: "idx_properties_sync_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_properties_sync_status 
          ON properties_cache (sync_status, last_synced_at)`,
  },
  {
    name: "idx_properties_search_vector",
    sql: `CREATE INDEX IF NOT EXISTS idx_properties_search_vector 
          ON properties_cache USING gin(search_vector)`,
  },
  {
    name: "idx_images_processing_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_images_processing_status 
          ON property_images (processing_status, property_id)`,
  },
]

async function createIndexes() {
  console.log("🚀 Starting index creation...")

  for (const index of indexes) {
    try {
      console.log(`📝 Creating index: ${index.name}`)

      const { error } = await supabase.rpc("exec_sql", {
        sql: index.sql,
      })

      if (error) {
        console.error(`❌ Error creating ${index.name}:`, error.message)
      } else {
        console.log(`✅ Successfully created: ${index.name}`)
      }

      // Small delay between index creations
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (err) {
      console.error(`❌ Exception creating ${index.name}:`, err)
    }
  }

  // Analyze tables
  console.log("📊 Analyzing tables...")
  try {
    await supabase.rpc("exec_sql", { sql: "ANALYZE properties_cache" })
    await supabase.rpc("exec_sql", { sql: "ANALYZE property_images" })
    console.log("✅ Table analysis complete")
  } catch (err) {
    console.error("❌ Error analyzing tables:", err)
  }

  console.log("🎉 Index creation process complete!")
}

// Check if exec_sql function exists, if not provide alternative
async function checkAndCreateExecFunction() {
  const { data, error } = await supabase.from("pg_proc").select("proname").eq("proname", "exec_sql").single()

  if (error || !data) {
    console.log("📝 Creating exec_sql function...")

    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `

    const { error: createError } = await supabase.rpc("exec", {
      sql: createFunctionSQL,
    })

    if (createError) {
      console.error("❌ Could not create exec_sql function:", createError)
      return false
    }

    console.log("✅ exec_sql function created")
  }

  return true
}

async function main() {
  try {
    const functionReady = await checkAndCreateExecFunction()
    if (functionReady) {
      await createIndexes()
    } else {
      console.log("⚠️  Please run the SQL scripts manually in Supabase SQL Editor")
    }
  } catch (error) {
    console.error("❌ Setup failed:", error)
  }
}

main()
