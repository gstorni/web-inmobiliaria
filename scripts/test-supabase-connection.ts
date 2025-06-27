import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔍 Testing Supabase Connection")
console.log("=".repeat(50))

async function testConnection() {
  const supabaseUrl = null
  const supabaseKey = null

  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Supabase environment variables not found")
    console.log("   Make sure your .env.local file has:")
    console.log("   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
    console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")
    return
  }

  console.log(`📍 Testing connection to: ${supabaseUrl}`)

  try {
    // Test basic HTTP connection first
    console.log("🌐 Testing basic HTTP connection...")
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })

    if (response.ok) {
      console.log("✅ Basic HTTP connection successful!")
    } else {
      console.log(`❌ HTTP connection failed: ${response.status} ${response.statusText}`)
      return
    }

    // Test Supabase client
    console.log("🔗 Testing Supabase client...")
    const { createClient } = await import("@supabase/supabase-js")
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test with a simple query
    const { data, error } = await supabase.from("processing_checkpoints").select("count").limit(1)

    if (error) {
      if (error.code === "42P01") {
        console.log("✅ Supabase client works, but table doesn't exist yet")
        console.log("   This is expected - run the setup script to create tables")
      } else {
        console.log("❌ Supabase client error:", error.message)
      }
    } else {
      console.log("✅ Supabase client connection successful!")
    }
  } catch (error: any) {
    console.log("❌ Connection test failed:", error.message)

    if (error.message.includes("fetch failed")) {
      console.log("\n🔧 Possible solutions:")
      console.log("   • Check your internet connection")
      console.log("   • Verify Supabase URL is correct")
      console.log("   • Check if you're behind a firewall")
      console.log("   • Try from a different network")
    }
  }
}

testConnection()
