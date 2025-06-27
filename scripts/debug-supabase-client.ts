// Debug script to test Supabase client initialization
import dotenv from "dotenv"
import path from "path"

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config()

async function debugSupabaseClient() {
  console.log("🔍 Debugging Supabase client initialization...")

  // Check environment variables
  const supabaseUrl = null
  const supabaseAnonKey = null
  const supabaseServiceKey = null

  console.log("\n📋 Environment Variables:")
  console.log("- NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
  console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing")
  console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅ Set" : "❌ Missing")

  if (supabaseUrl) {
    console.log("- URL Preview:", supabaseUrl.substring(0, 30) + "...")
  }

  // Try to import and test the clients
  try {
    console.log("\n🔧 Testing Supabase client imports...")

    // Import the clients
    const { supabase, supabaseAdmin, getSupabaseClient, getSupabaseAdminClient } = await import(
      "../lib/supabase-client"
    )

    console.log("✅ Supabase client module imported successfully")

    // Test regular client
    console.log("\n🧪 Testing regular client...")
    if (supabase) {
      console.log("✅ Regular Supabase client is available")
      try {
        const client = getSupabaseClient()
        console.log("✅ getSupabaseClient() works")
      } catch (error) {
        console.error("❌ getSupabaseClient() failed:", error)
      }
    } else {
      console.log("❌ Regular Supabase client is null")
    }

    // Test admin client
    console.log("\n🧪 Testing admin client...")
    if (supabaseAdmin) {
      console.log("✅ Supabase admin client is available")
      try {
        const adminClient = getSupabaseAdminClient()
        console.log("✅ getSupabaseAdminClient() works")

        // Test a simple query
        console.log("🔗 Testing admin client connection...")
        const { data, error } = await adminClient.from("information_schema.tables").select("table_name").limit(1)

        if (error) {
          console.error("❌ Admin client connection failed:", error)
        } else {
          console.log("✅ Admin client connection successful!")
        }
      } catch (error) {
        console.error("❌ getSupabaseAdminClient() failed:", error)
      }
    } else {
      console.log("❌ Supabase admin client is null")

      // Try to create it manually for debugging
      console.log("\n🔧 Attempting manual admin client creation...")
      try {
        const { createClient } = await import("@supabase/supabase-js")

        if (supabaseUrl && supabaseServiceKey) {
          const testAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })

          console.log("✅ Manual admin client creation successful")

          // Test it
          const { data, error } = await testAdmin.from("information_schema.tables").select("table_name").limit(1)

          if (error) {
            console.error("❌ Manual admin client test failed:", error)
          } else {
            console.log("✅ Manual admin client test successful!")
          }
        } else {
          console.log("❌ Cannot create manual client - missing URL or service key")
        }
      } catch (error) {
        console.error("❌ Manual admin client creation failed:", error)
      }
    }
  } catch (error) {
    console.error("❌ Failed to import Supabase client module:", error)
  }

  console.log("\n🎯 Summary:")
  console.log("If the admin client is null but environment variables are set,")
  console.log("there might be an issue with the client initialization logic.")
}

// Run the debug function
debugSupabaseClient().catch(console.error)
