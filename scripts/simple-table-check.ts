import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

const supabaseUrl = null
const supabaseServiceKey = null

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables")
  console.error("Please add these to your .env.local file:")
  console.error("NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
  console.error("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function simpleCheck() {
  console.log("🔍 Simple Database Check")
  console.log("=======================")

  // Test basic connection
  try {
    const { data, error } = await supabase.from("properties_cache").select("count", { count: "exact", head: true })

    if (error) {
      console.log("❌ properties_cache table:", error.message)
      console.log("💡 You may need to run the setup script first")
    } else {
      console.log(`✅ properties_cache table: ${data?.length || 0} records`)
    }
  } catch (error) {
    console.log("❌ Connection error:", error)
  }

  // Test images table
  try {
    const { data, error } = await supabase.from("property_images").select("count", { count: "exact", head: true })

    if (error) {
      console.log("❌ property_images table:", error.message)
    } else {
      console.log(`✅ property_images table: ${data?.length || 0} records`)
    }
  } catch (error) {
    console.log("❌ Images table error:", error)
  }

  console.log("\n🎯 Status Summary:")
  console.log("If you see errors above, run:")
  console.log("1. npx tsx scripts/setup-enhanced-monitoring-fixed.ts")
  console.log("2. Then run the SQL index scripts in Supabase dashboard")
}

simpleCheck()
