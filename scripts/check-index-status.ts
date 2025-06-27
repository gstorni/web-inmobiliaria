import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const supabaseUrl = null
const supabaseServiceKey = null

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkIndexes() {
  console.log("🔍 Checking database structure and indexes...")

  try {
    // First, check if our main tables exist
    console.log("\n📋 Checking Tables:")
    console.log("==================")

    const tables = ["properties_cache", "property_images", "property_access_logs", "cache_performance_metrics"]

    for (const tableName of tables) {
      const { data, error } = await supabase.from(tableName).select("*", { count: "exact", head: true })

      if (error) {
        console.log(`❌ ${tableName}: ${error.message}`)
      } else {
        console.log(`✅ ${tableName}: ${data?.length || 0} records`)
      }
    }

    // Check properties_cache structure and sample data
    console.log("\n🏠 Properties Cache Sample:")
    console.log("===========================")

    const { data: properties, error: propError } = await supabase
      .from("properties_cache")
      .select("id, tokko_id, title, property_type, cached_at, last_synced_at")
      .limit(5)

    if (propError) {
      console.log(`❌ Error fetching properties: ${propError.message}`)
    } else if (properties && properties.length > 0) {
      properties.forEach((prop, index) => {
        console.log(`${index + 1}. ID: ${prop.id}, Tokko ID: ${prop.tokko_id}`)
        console.log(`   Title: ${prop.title?.substring(0, 50)}...`)
        console.log(`   Type: ${prop.property_type}`)
        console.log(`   Cached: ${prop.cached_at}`)
        console.log("")
      })
    } else {
      console.log("⚠️  No properties found in cache")
    }

    // Check for performance metrics table
    console.log("📊 Performance Metrics:")
    console.log("======================")

    const { data: metrics, error: metricsError } = await supabase
      .from("cache_performance_metrics")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(3)

    if (metricsError) {
      console.log(`❌ Performance metrics table: ${metricsError.message}`)
      console.log("💡 Run the setup script to create performance tracking tables")
    } else if (metrics && metrics.length > 0) {
      console.log("✅ Performance metrics available:")
      metrics.forEach((metric, index) => {
        console.log(`${index + 1}. ${metric.timestamp}: ${metric.metric_name} = ${metric.metric_value}`)
      })
    } else {
      console.log("⚠️  No performance metrics recorded yet")
    }

    // Test a simple query to check performance
    console.log("\n⚡ Testing Query Performance:")
    console.log("=============================")

    const startTime = Date.now()
    const { data: testQuery, error: testError } = await supabase
      .from("properties_cache")
      .select("id, title, property_type")
      .eq("status", 1)
      .limit(10)

    const queryTime = Date.now() - startTime

    if (testError) {
      console.log(`❌ Test query failed: ${testError.message}`)
    } else {
      console.log(`✅ Query completed in ${queryTime}ms`)
      console.log(`📊 Found ${testQuery?.length || 0} active properties`)

      if (queryTime > 1000) {
        console.log("⚠️  Query is slow - consider running the index creation script")
      } else if (queryTime < 100) {
        console.log("🚀 Query performance is excellent!")
      } else {
        console.log("👍 Query performance is good")
      }
    }

    // Check if we can access system information (might be limited in Supabase)
    console.log("\n🔧 System Information:")
    console.log("======================")

    try {
      const { data: version } = await supabase.rpc("version")
      if (version) {
        console.log(`✅ PostgreSQL Version: ${version}`)
      }
    } catch (error) {
      console.log("⚠️  System version info not accessible")
    }

    console.log("\n✅ Database check completed!")
    console.log("\n💡 Next Steps:")
    console.log("- If tables are missing, run: npx tsx scripts/setup-enhanced-monitoring-fixed.ts")
    console.log("- If performance is slow, run the index creation SQL in Supabase dashboard")
    console.log("- If everything looks good, access the dashboard at /enhanced-dashboard")
  } catch (error) {
    console.error("❌ Unexpected error:", error)
  }
}

checkIndexes()
