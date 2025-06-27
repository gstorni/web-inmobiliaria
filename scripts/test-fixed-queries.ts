import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function testFixedQueries() {
  console.log("🔧 TESTING FIXED SUPABASE QUERIES")
  console.log("============================================================")

  // Check if environment variables are loaded
  const supabaseUrl = null
  const supabaseKey = null

  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ ENVIRONMENT VARIABLES NOT FOUND")
    console.log("Expected in .env.local:")
    console.log("- NEXT_PUBLIC_SUPABASE_URL")
    console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY")
    console.log("\nCurrent values:")
    console.log("- SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
    console.log("- SUPABASE_KEY:", supabaseKey ? "✅ Set" : "❌ Missing")
    return
  }

  console.log("✅ Environment variables loaded successfully")
  console.log("- SUPABASE_URL:", supabaseUrl.substring(0, 30) + "...")
  console.log("- SUPABASE_KEY:", supabaseKey.substring(0, 20) + "...")

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Test 1: Count query (FIXED syntax)
    console.log("\n📊 TEST 1: Count Query (Fixed Syntax)")
    console.log("----------------------------------------")

    const { count, error: countError } = await supabase
      .from("processing_checkpoints")
      .select("*", { count: "exact", head: true })

    if (countError) {
      console.log("❌ Count query failed:", countError.message)
    } else {
      console.log("✅ Count query successful:", count, "records")
    }

    // Test 2: Select active checkpoints (FIXED syntax)
    console.log("\n🔍 TEST 2: Select Active Checkpoints")
    console.log("----------------------------------------")

    const { data: activeData, error: activeError } = await supabase
      .from("processing_checkpoints")
      .select(
        "id, process_type, process_id, status, total_items, processed_items, failed_items, current_batch, started_at, updated_at, completed_at",
      )
      .in("status", ["running", "paused"])
      .order("updated_at", { ascending: false })
      .limit(10)

    if (activeError) {
      console.log("❌ Active checkpoints query failed:", activeError.message)
    } else {
      console.log("✅ Active checkpoints query successful:", activeData?.length || 0, "records")
    }

    // Test 3: Select all checkpoints (FIXED syntax)
    console.log("\n📋 TEST 3: Select All Checkpoints")
    console.log("----------------------------------------")

    const { data: allData, error: allError } = await supabase
      .from("processing_checkpoints")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(5)

    if (allError) {
      console.log("❌ All checkpoints query failed:", allError.message)
    } else {
      console.log("✅ All checkpoints query successful:", allData?.length || 0, "records")
      if (allData && allData.length > 0) {
        console.log("📄 Sample record:", {
          id: allData[0].id,
          process_type: allData[0].process_type,
          status: allData[0].status,
          created: allData[0].started_at,
        })
      }
    }

    // Test 4: Insert test record (to verify table works)
    console.log("\n➕ TEST 4: Insert Test Record")
    console.log("----------------------------------------")

    const testRecord = {
      process_type: "test_query_fix",
      process_id: `test_${Date.now()}`,
      status: "completed",
      total_items: 100,
      processed_items: 100,
      failed_items: 0,
      current_batch: 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }

    const { data: insertData, error: insertError } = await supabase
      .from("processing_checkpoints")
      .insert(testRecord)
      .select()
      .single()

    if (insertError) {
      console.log("❌ Insert test failed:", insertError.message)
    } else {
      console.log("✅ Insert test successful, ID:", insertData?.id)

      // Clean up test record
      await supabase.from("processing_checkpoints").delete().eq("id", insertData.id)

      console.log("🧹 Test record cleaned up")
    }

    console.log("\n🎯 SUMMARY")
    console.log("============================================================")
    console.log("✅ All query syntax issues should now be fixed!")
    console.log("🚀 Ready to test the dashboard at /cache-dashboard")
  } catch (error: any) {
    console.error("❌ Unexpected error:", error.message)
  }
}

testFixedQueries().catch(console.error)
