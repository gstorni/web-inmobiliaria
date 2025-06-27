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

async function checkDatabaseSchema() {
  console.log("🔍 Checking Database Schema")
  console.log("==========================")

  try {
    // Check what columns actually exist in properties_cache
    console.log("\n📋 Properties Cache Table Structure:")
    console.log("====================================")

    const { data: sample, error: sampleError } = await supabase.from("properties_cache").select("*").limit(1)

    if (sampleError) {
      console.log("❌ Cannot access properties_cache:", sampleError.message)
    } else if (sample && sample.length > 0) {
      console.log("✅ Properties cache columns found:")
      Object.keys(sample[0]).forEach((column) => {
        console.log(`   - ${column}`)
      })
    } else {
      console.log("⚠️  Properties cache table is empty")

      // Try a simple insert to see what columns are expected
      console.log("\nTrying to understand table structure...")
      const { error: insertError } = await supabase.from("properties_cache").insert({ id: -1 }).select()

      if (insertError) {
        console.log("Table structure hints from error:", insertError.message)
      }
    }

    // Check property_images table
    console.log("\n🖼️  Property Images Table:")
    console.log("==========================")

    const { data: imagesSample, error: imagesError } = await supabase.from("property_images").select("*").limit(1)

    if (imagesError) {
      console.log("❌ Cannot access property_images:", imagesError.message)
    } else if (imagesSample && imagesSample.length > 0) {
      console.log("✅ Property images columns:")
      Object.keys(imagesSample[0]).forEach((column) => {
        console.log(`   - ${column}`)
      })
    } else {
      console.log("⚠️  Property images table is empty")
    }

    // Check if performance tracking tables exist
    console.log("\n📊 Performance Tracking Tables:")
    console.log("===============================")

    const performanceTables = ["cache_performance_metrics", "property_access_logs"]

    for (const tableName of performanceTables) {
      const { data, error } = await supabase.from(tableName).select("*", { count: "exact", head: true })

      if (error) {
        console.log(`❌ ${tableName}: ${error.message}`)
      } else {
        console.log(`✅ ${tableName}: Table exists`)
      }
    }

    // Test a simple query to see what works
    console.log("\n⚡ Testing Basic Queries:")
    console.log("========================")

    const { data: countData, error: countError } = await supabase
      .from("properties_cache")
      .select("*", { count: "exact", head: true })

    if (countError) {
      console.log("❌ Count query failed:", countError.message)
    } else {
      console.log(`✅ Properties cache has ${countData?.length || 0} records`)
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error)
  }

  console.log("\n🎯 Next Steps:")
  console.log("==============")
  console.log("1. If tables are missing columns, run: npx tsx scripts/fix-database-schema.ts")
  console.log("2. If performance tables don't exist, run the SQL script manually")
  console.log("3. If everything looks good, try syncing some properties first")
}

checkDatabaseSchema()
