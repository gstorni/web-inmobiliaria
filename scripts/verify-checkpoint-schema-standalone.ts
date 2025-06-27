// Standalone script to verify checkpoint schema without importing other modules
import dotenv from "dotenv"
import path from "path"

// Load environment variables first
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config()

async function verifyCheckpointSchema() {
  console.log("🔍 Verifying checkpoint table schema...")

  // Check environment variables
  const supabaseUrl = null
  const supabaseAnonKey = null
  const supabaseServiceKey = null

  console.log("\n📋 Environment Variables:")
  console.log("- NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
  console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing")
  console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅ Set" : "❌ Missing")

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.log("\n❌ Missing required environment variables")
    return
  }

  // Create admin client directly
  console.log("\n🔧 Creating Supabase admin client...")
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  })

  console.log("✅ Admin client created successfully")

  try {
    // Test connection
    console.log("\n🔗 Testing Supabase connection...")
    const { data: connectionTest, error: connectionError } = await supabaseAdmin
      .from("processing_checkpoints")
      .select("count")
      .limit(0)

    if (connectionError) {
      if (connectionError.code === "42P01") {
        console.error("❌ Table 'processing_checkpoints' does not exist!")
        console.log("📝 Please run the create-checkpoint-tables-fixed.sql script in your Supabase SQL Editor")
        return
      } else {
        console.error("❌ Connection error:", connectionError)
        return
      }
    }

    console.log("✅ Connection successful and table exists!")

    // Test inserting a checkpoint with the expected schema
    console.log("\n🧪 Testing checkpoint operations...")

    const testProcessId = "schema-test-" + Date.now()
    const testCheckpoint = {
      process_type: "test",
      process_id: testProcessId,
      status: "running",
      total_items: 100,
      processed_items: 0,
      checkpoint_data: { test: true }, // Using snake_case
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Test INSERT
    console.log("📝 Testing checkpoint creation...")
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from("processing_checkpoints")
      .insert(testCheckpoint)
      .select()

    if (insertError) {
      console.error("❌ Failed to create checkpoint:", insertError)

      if (insertError.message.includes("column") && insertError.message.includes("does not exist")) {
        console.log("\n🔍 Column mismatch detected. Let's check the actual table structure...")

        // Try to get table structure
        const { data: tableInfo, error: tableError } = await supabaseAdmin.rpc("get_table_info", {
          table_name: "processing_checkpoints",
        })

        if (tableError) {
          console.log("⚠️ Could not get table info via RPC, trying direct query...")

          // Try a simple select to see what columns exist
          const { data: sampleData, error: sampleError } = await supabaseAdmin
            .from("processing_checkpoints")
            .select("*")
            .limit(1)

          if (sampleError) {
            console.error("❌ Could not query table:", sampleError)
          } else {
            console.log("✅ Table query successful, but schema mismatch in INSERT")
            console.log("📋 This suggests the table exists but has different column names")
          }
        } else {
          console.log("📋 Table structure:", tableInfo)
        }
      }
      return
    }

    console.log("✅ Checkpoint creation successful!")

    // Test UPDATE
    console.log("📝 Testing checkpoint update...")
    const { error: updateError } = await supabaseAdmin
      .from("processing_checkpoints")
      .update({
        processed_items: 50,
        checkpoint_data: { test: true, progress: "halfway" }, // Using snake_case
        updated_at: new Date().toISOString(),
      })
      .eq("process_id", testProcessId)

    if (updateError) {
      console.error("❌ Failed to update checkpoint:", updateError)
      return
    }

    console.log("✅ Checkpoint update successful!")

    // Test completion
    console.log("📝 Testing checkpoint completion...")
    const { error: completeError } = await supabaseAdmin
      .from("processing_checkpoints")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("process_id", testProcessId)

    if (completeError) {
      console.error("❌ Failed to complete checkpoint:", completeError)
      return
    }

    console.log("✅ Checkpoint completion successful!")

    // Clean up test data
    console.log("🧹 Cleaning up test data...")
    await supabaseAdmin.from("processing_checkpoints").delete().eq("process_id", testProcessId)

    console.log("✅ Test data cleaned up!")

    console.log("\n🎉 Checkpoint schema verification completed successfully!")
    console.log("📝 Your checkpoint system should now work properly!")

    // Test the actual checkpoint service
    console.log("\n🔧 Testing checkpoint service integration...")

    try {
      // Import and test the checkpoint service
      const { checkpointService } = await import("../lib/checkpoint-service")

      const serviceTestId = "service-test-" + Date.now()

      await checkpointService.createCheckpoint({
        processType: "integration_test",
        processId: serviceTestId,
        totalItems: 10,
      })

      console.log("✅ Checkpoint service creation works!")

      // Use snake_case for the update parameters to match database schema
      await checkpointService.updateCheckpoint(serviceTestId, {
        processedItems: 5,
        checkpointData: { integration: "test" }, // This will be converted to checkpoint_data
      })

      console.log("✅ Checkpoint service update works!")

      await checkpointService.completeCheckpoint(serviceTestId)

      console.log("✅ Checkpoint service completion works!")

      await checkpointService.cleanupCheckpoint(serviceTestId)

      console.log("✅ Checkpoint service cleanup works!")

      console.log("\n🎉 Full integration test successful!")
    } catch (serviceError) {
      console.error("❌ Checkpoint service integration failed:", serviceError)
      console.log("📝 The database schema is correct, but there may be an issue with the service code")

      // Let's test the service methods individually to isolate the issue
      console.log("\n🔍 Testing individual service methods...")

      try {
        const { checkpointService } = await import("../lib/checkpoint-service")

        // Test just the creation
        const isolatedTestId = "isolated-test-" + Date.now()
        await checkpointService.createCheckpoint({
          processType: "isolated_test",
          processId: isolatedTestId,
          totalItems: 5,
        })
        console.log("✅ Individual creation test passed")

        // Clean up
        await checkpointService.cleanupCheckpoint(isolatedTestId)
        console.log("✅ Individual cleanup test passed")
      } catch (isolatedError) {
        console.error("❌ Even isolated service test failed:", isolatedError)
        console.log("📝 The issue is likely in the checkpoint service implementation")
      }
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error)
  }
}

// Run the verification
verifyCheckpointSchema().catch((error) => {
  console.error("❌ Script failed:", error)
  process.exit(1)
})
