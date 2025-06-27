// Load environment variables from .env.local
import dotenv from "dotenv"
import path from "path"

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

// Also try .env as fallback
dotenv.config()

// Script to verify the checkpoint table schema matches our expectations

async function checkSupabaseConfig() {
  console.log("🔍 Checking environment variables...")
  console.log("Current working directory:", process.cwd())

  const supabaseUrl = null
  const supabaseAnonKey = null
  const supabaseServiceKey = null

  console.log("Environment check:")
  console.log("- NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
  console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing")
  console.log("- SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅ Set" : "❌ Missing")

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("\n❌ Missing required Supabase environment variables:")
    if (!supabaseUrl) console.error("   - NEXT_PUBLIC_SUPABASE_URL")
    if (!supabaseAnonKey) console.error("   - NEXT_PUBLIC_SUPABASE_ANON_KEY")

    console.log("\n📝 Please ensure these are in your .env.local file:")
    console.log("NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co")
    console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here")

    if (!supabaseServiceKey) {
      console.error("   - SUPABASE_SERVICE_ROLE_KEY (required for admin operations)")
      console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
    }

    console.log("\n🔍 Troubleshooting:")
    console.log("1. Make sure the .env.local file is in your project root")
    console.log("2. Check that variable names are spelled correctly")
    console.log("3. Ensure there are no spaces around the = sign")
    console.log("4. Try restarting your terminal/IDE")

    return false
  }

  if (!supabaseServiceKey) {
    console.error("\n❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
    console.log("📝 This is required for admin operations like schema verification")
    console.log("Please add to your .env.local file:")
    console.log("SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here")
    return false
  }

  return true
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
    console.log("📝 Please check your environment variables and restart the application")
    return
  }

  try {
    // Test the connection first
    console.log("\n🔗 Testing Supabase connection...")
    const { data: connectionTest, error: connectionError } = await supabaseAdmin
      .from("information_schema.tables")
      .select("table_name")
      .limit(1)

    if (connectionError) {
      console.error("❌ Failed to connect to Supabase:", connectionError)
      console.log("📝 Please verify your Supabase credentials and network connection")
      return
    }

    console.log("✅ Supabase connection successful!")

    // Check if table exists and get its structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from("information_schema.columns")
      .select("column_name, data_type, is_nullable")
      .eq("table_name", "processing_checkpoints")
      .eq("table_schema", "public")

    if (tableError) {
      console.error("❌ Error checking table schema:", tableError)
      return
    }

    if (!tableInfo || tableInfo.length === 0) {
      console.error("❌ Table 'processing_checkpoints' does not exist!")
      console.log("📝 Please run the create-checkpoint-tables.sql script first.")
      console.log("   You can find it in: scripts/create-checkpoint-tables.sql")
      console.log("   Run it in your Supabase SQL Editor")
      return
    }

    console.log("✅ Table 'processing_checkpoints' exists!")
    console.log("\n📋 Current table schema:")

    const expectedColumns = [
      "id",
      "process_type",
      "process_id",
      "status",
      "total_items",
      "processed_items",
      "failed_items",
      "current_batch",
      "last_processed_id",
      "last_processed_tokko_id",
      "checkpoint_data",
      "error_log",
      "started_at",
      "updated_at",
      "completed_at",
    ]

    const actualColumns = tableInfo.map((col) => col.column_name)

    tableInfo.forEach((col) => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })

    console.log("\n🔍 Checking for missing columns:")
    const missingColumns = expectedColumns.filter((col) => !actualColumns.includes(col))

    if (missingColumns.length > 0) {
      console.error("❌ Missing columns:", missingColumns)
      console.log("📝 Please run the create-checkpoint-tables.sql script to add missing columns.")
      console.log("   The script will safely add any missing columns without affecting existing data.")
    } else {
      console.log("✅ All expected columns are present!")
    }

    // Test a simple insert/update to verify the schema works
    console.log("\n🧪 Testing checkpoint operations...")

    const testCheckpoint = {
      process_type: "test",
      process_id: "schema-test-" + Date.now(),
      status: "running" as const,
      total_items: 100,
      processed_items: 0,
      checkpoint_data: { test: true },
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: insertError } = await supabaseAdmin.from("processing_checkpoints").insert(testCheckpoint)

    if (insertError) {
      console.error("❌ Error inserting test checkpoint:", insertError)
      console.log("📝 This might indicate a permissions issue or schema mismatch")
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
    console.log("\n🎉 Checkpoint schema verification completed successfully!")
    console.log("📝 Your checkpoint system should now work properly!")
  } catch (error) {
    console.error("❌ Unexpected error during schema verification:", error)

    if (error instanceof Error) {
      if (error.message.includes("JWT")) {
        console.log("📝 This looks like an authentication error. Please check your SUPABASE_SERVICE_ROLE_KEY")
      } else if (error.message.includes("network") || error.message.includes("fetch")) {
        console.log("📝 This looks like a network error. Please check your internet connection and Supabase URL")
      }
    }
  }
}

// Run the verification
verifyCheckpointSchema().catch((error) => {
  console.error("❌ Script failed to run:", error)
  process.exit(1)
})
