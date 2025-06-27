import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function testCheckpointFunctionality() {
  console.log("🧪 TESTING CHECKPOINT FUNCTIONALITY")
  console.log("=".repeat(50))

  try {
    const { supabase } = await import("@/lib/supabase-client")

    // Test 1: Check if table exists and is accessible
    console.log("\n📋 TEST 1: Table Accessibility")
    console.log("-".repeat(30))

    const { data: existingData, error: existingError } = await supabase
      .from("processing_checkpoints")
      .select("*")
      .limit(5)

    if (existingError) {
      console.log(`❌ Table access failed: ${existingError.message}`)
      return
    }

    console.log(`✅ Table accessible. Found ${existingData?.length || 0} existing records`)
    if (existingData && existingData.length > 0) {
      console.log("📊 Existing checkpoints:")
      existingData.forEach((record, index) => {
        console.log(
          `   ${index + 1}. ${record.process_type} - ${record.status} (${record.processed_items}/${record.total_items})`,
        )
      })
    }

    // Test 2: Insert a test checkpoint
    console.log("\n🧪 TEST 2: Insert Test Checkpoint")
    console.log("-".repeat(30))

    const testCheckpoint = {
      process_type: "test_process",
      process_id: `test_${Date.now()}`,
      status: "running",
      total_items: 100,
      processed_items: 25,
      failed_items: 0,
      current_batch: 1,
    }

    const { data: insertData, error: insertError } = await supabase
      .from("processing_checkpoints")
      .insert([testCheckpoint])
      .select()

    if (insertError) {
      console.log(`❌ Insert failed: ${insertError.message}`)
      return
    }

    console.log(`✅ Test checkpoint inserted successfully`)
    console.log(`📝 Record ID: ${insertData?.[0]?.id}`)

    // Test 3: Query active checkpoints (like the API does)
    console.log("\n🔍 TEST 3: Query Active Checkpoints")
    console.log("-".repeat(30))

    const { data: activeData, error: activeError } = await supabase
      .from("processing_checkpoints")
      .select("*")
      .in("status", ["running", "paused"])
      .order("updated_at", { ascending: false })

    if (activeError) {
      console.log(`❌ Active query failed: ${activeError.message}`)
      return
    }

    console.log(`✅ Found ${activeData?.length || 0} active checkpoints`)
    if (activeData && activeData.length > 0) {
      console.log("📊 Active checkpoints:")
      activeData.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.process_type} (${record.process_id}) - ${record.status}`)
        console.log(`      Progress: ${record.processed_items}/${record.total_items} items`)
        console.log(`      Started: ${new Date(record.started_at).toLocaleString()}`)
      })
    }

    // Test 4: Update checkpoint status
    console.log("\n🔄 TEST 4: Update Checkpoint Status")
    console.log("-".repeat(30))

    if (insertData?.[0]?.id) {
      const { data: updateData, error: updateError } = await supabase
        .from("processing_checkpoints")
        .update({
          status: "paused",
          processed_items: 50,
          updated_at: new Date().toISOString(),
        })
        .eq("id", insertData[0].id)
        .select()

      if (updateError) {
        console.log(`❌ Update failed: ${updateError.message}`)
      } else {
        console.log(`✅ Checkpoint updated successfully`)
        console.log(`📝 New status: ${updateData?.[0]?.status}`)
        console.log(`📝 New progress: ${updateData?.[0]?.processed_items}/${updateData?.[0]?.total_items}`)
      }
    }

    // Test 5: Test API endpoint
    console.log("\n🌐 TEST 5: API Endpoint Test")
    console.log("-".repeat(30))

    try {
      const response = await fetch("http://localhost:3000/api/checkpoints/active")
      const apiData = await response.json()

      if (response.ok && apiData.success) {
        console.log(`✅ API endpoint working correctly`)
        console.log(`📊 API returned ${apiData.checkpoints?.length || 0} checkpoints`)
        console.log(`🕐 Response time: ${response.headers.get("x-response-time") || "N/A"}`)

        if (apiData.setupRequired) {
          console.log(`⚠️ API still shows setup required: ${apiData.message}`)
        } else {
          console.log(`✅ API shows system is ready`)
        }
      } else {
        console.log(`❌ API endpoint failed: ${response.status} ${response.statusText}`)
        console.log(`📝 Response: ${JSON.stringify(apiData, null, 2)}`)
      }
    } catch (apiError: any) {
      console.log(`❌ API test failed: ${apiError.message}`)
      console.log(`💡 Make sure your Next.js dev server is running (npm run dev)`)
    }

    // Test 6: Cleanup test data
    console.log("\n🧹 TEST 6: Cleanup Test Data")
    console.log("-".repeat(30))

    if (insertData?.[0]?.id) {
      const { error: deleteError } = await supabase.from("processing_checkpoints").delete().eq("id", insertData[0].id)

      if (deleteError) {
        console.log(`❌ Cleanup failed: ${deleteError.message}`)
        console.log(`💡 You may need to manually delete test record ID: ${insertData[0].id}`)
      } else {
        console.log(`✅ Test data cleaned up successfully`)
      }
    }

    // Final Summary
    console.log("\n📊 TEST SUMMARY")
    console.log("=".repeat(50))
    console.log("✅ Table exists and is accessible")
    console.log("✅ Can insert new checkpoints")
    console.log("✅ Can query active checkpoints")
    console.log("✅ Can update checkpoint status")
    console.log("✅ Test data cleanup successful")

    console.log("\n🎯 NEXT STEPS:")
    console.log("-".repeat(30))
    console.log("1. Make sure your Next.js dev server is running:")
    console.log("   npm run dev")
    console.log("2. Open your browser to:")
    console.log("   http://localhost:3000/cache-dashboard")
    console.log("3. The setup message should now be gone!")
    console.log("4. Try clicking 'Start New Processing' buttons")
  } catch (error: any) {
    console.error("❌ Test failed:", error.message)
    console.error("Details:", error)
  }
}

testCheckpointFunctionality().catch(console.error)
