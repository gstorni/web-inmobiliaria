// Script to check Supabase configuration
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]

console.log("🔍 Supabase Configuration Check")
console.log("=".repeat(50))

let allGood = true
const config_status: Record<string, string> = {}

requiredEnvVars.forEach((varName) => {
  const value = process.env[varName]
  if (value) {
    // Show first 20 chars for security
    const preview = value.length > 20 ? `${value.substring(0, 20)}...` : value
    console.log(`✅ ${varName}: ${preview}`)
    config_status[varName] = "✅ Set"
  } else {
    console.log(`❌ ${varName}: NOT SET`)
    config_status[varName] = "❌ Missing"
    allGood = false
  }
})

console.log("=".repeat(50))

if (allGood) {
  console.log("🎉 All Supabase environment variables are set!")
  console.log("\n🔗 Testing connection...")

  // Test connection
  testSupabaseConnection()
} else {
  console.log("❌ Missing Supabase environment variables!")
  console.log("\n💡 Create/update your .env.local file with:")
  console.log("NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
  console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
  console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
  console.log("\n📍 Get these from your Supabase project dashboard:")
  console.log("   Settings > API > Project URL & API Keys")
}

async function testSupabaseConnection() {
  try {
    const { createClient } = await import("@supabase/supabase-js")

    const supabaseUrl = null!
    const supabaseKey = null!

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test with a simple query
    const { data, error } = await supabase.from("cached_properties").select("count").limit(1)

    if (error) {
      if (error.code === "42P01") {
        console.log("⚠️  Connection successful, but tables don't exist yet")
        console.log("   Run: npm run setup-supabase")
      } else {
        console.log("❌ Connection failed:", error.message)
      }
    } else {
      console.log("✅ Supabase connection successful!")
    }
  } catch (error) {
    console.log("❌ Failed to test connection:", error)
  }
}
