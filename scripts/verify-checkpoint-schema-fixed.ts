// Load environment variables from .env.local
import dotenv from "dotenv"
import path from "path"

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config()

// Script to verify the checkpoint table schema matches our expectations

async function checkSupabaseConfig() {
  console.log("🔍 Checking environment variables...")

  const supabaseUrl = null
  const supabaseAnonKey = null
  const supabaseServiceKey = null

  console.log("Environment check:")
  console.log("- NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
  console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing")
  console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅ Set" : "❌ Missing")

  return !!(supabaseUrl && supabaseAnonKey && supabaseServiceKey)
}

async function verifyCheckpointSchema() {
  console.log("🔍 Verifying checkpoint table schema...")

  // Check Supabase configuration first
  const configValid = await checkSupabaseConfig()
  if (!configValid) {
    console.log("\n❌ Cannot proceed without proper Supabase configuration")
    return
  }

  // Check if supabaseAdmin client is available
  if (!supabaseAdmin) {
    console.error("❌ Supabase admin client not initialized")
    return
  }

  try {
    // Test the connection first with a simple query
    console.log("\n🔗 Testing Supabase connection...")
    const { data: connectionTest, error: connectionError } = await supabaseAdmin.rpc("version")

    if (connectionError) {
      console.error("❌ Failed to connect to Supabase:", connectionError)
      return
    }

    console.log("✅ Supabase connection successful!")

    // Check if table exists using a direct query
    console.log("\n🔍 Checking if processing_checkpoints table exists...")
    const { data: tableExists, error: tableExistsError } = await supabaseAdmin
      .from("processing_checkpoints")
      .select("*")
      .limit(0)

    if (tableExistsError) {
      if (tableExistsError.code === "42P01") {
        console.error("❌ Table 'processing_checkpoints' does not exist!")
        console.log("📝 Please run the create-checkpoint-tables.sql script first.")
        console.log("   You can find it in: scripts/create-checkpoint-tables.sql")
        console.log("   Run it in your Supabase SQL Editor")
        return
      } else {
        console.error("❌ Error checking table:", tableExistsError)
        return
      }
    }

    console.log("✅ Table 'processing_checkpoints' exists!")

    // Get table structure using PostgreSQL system catalogs
    console.log("\n📋 Getting table schema...")
    const { data: tableInfo, error: tableError } = await supabaseAdmin.rpc("get_table_columns", {
      table_name: "processing_checkpoints",
    })

    if (tableError) {
      // Fallback: try to get columns using a different approach
      console.log("⚠️ Using fallback method to get table structure...")

      // Try to insert a test record to see what columns are expected
      const testCheckpoint = {
        process_type: "test",
        process_id: "schema-test-" + Date.now(),
        status: "running",
        total_items: 100,
        processed_items: 0,
        checkpoint_data: { test: true },
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { error: insertError } = await supabaseAdmin.from("processing_checkpoints").insert(testCheckpoint)

      if (insertError) {
        console.error("❌ Error testing table structure:", insertError)

        if (insertError.message.includes("column") && insertError.message.includes("does not exist")) {
          console.log("📝 This indicates a column name mismatch.")
          console.log("   Please check that your table was created with the correct schema.")
          console.log("   Run the create-checkpoint-tables.sql script to ensure proper structure.")
        }
        return
      }

      console.log("✅ Test checkpoint inserted successfully!")

      // Clean up test data
      await supabaseAdmin
        .from("processing_checkpoints")
        .delete()
        .eq("process_type", "test")
        .eq("process_id", testCheckpoint.process_id)

      console.log("✅ Test data cleaned up!")
      console.log("\n🎉 Table structure appears to be correct!")
    } else {
      console.log("✅ Retrieved table schema!")
      console.log("Table columns:", tableInfo)
    }

    console.log("\n🧪 Testing checkpoint operations with correct column names...")

    // Test the actual checkpoint service
    const { checkpointService } = await import("../lib/checkpoint-service")

    const testProcessId = "schema-verification-" + Date.now()

    try {
      // Create a checkpoint
      await checkpointService.createCheckpoint({
        processType: "test",
        processId: testProcessId,
        totalItems: 100,
      })

      console.log("✅ Checkpoint creation successful!")

      // Update the checkpoint
      await checkpointService.updateCheckpoint(testProcessId, {
        processedItems: 50,
        checkpointData: { progress: "halfway" },
      })

      console.log("✅ Checkpoint update successful!")

      // Complete the checkpoint
      await checkpointService.completeCheckpoint(testProcessId)

      console.log("✅ Checkpoint completion successful!")

      // Clean up
      await checkpointService.cleanupCheckpoint(testProcessId)

      console.log("✅ Checkpoint cleanup successful!")
    } catch (error) {
      console.error("❌ Checkpoint service test failed:", error)
      return
    }

    console.log("\n🎉 Checkpoint schema verification completed successfully!")
    console.log("📝 Your checkpoint system should now work properly!")
  } catch (error) {
    console.error("❌ Unexpected error during schema verification:", error)
  }
}

// Run the verification
verifyCheckpointSchema().catch((error) => {
  console.error("❌ Script failed to run:", error)
  process.exit(1)
})
