import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function setupSupabaseTables() {
  console.log("🚀 Setting up Supabase tables...")
  console.log("==================================================")

  // Check environment variables first
  const supabaseUrl = null
  const supabaseServiceKey = null

  if (!supabaseUrl) {
    console.error("❌ NEXT_PUBLIC_SUPABASE_URL not found in environment")
    return
  }

  if (!supabaseServiceKey) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in environment")
    return
  }

  console.log(`✅ Supabase URL: ${supabaseUrl}`)
  console.log(`✅ Service key: ${supabaseServiceKey.substring(0, 20)}...`)

  try {
    // Import and create Supabase client
    const { createClient } = await import("@supabase/supabase-js")
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Test connection with a simple query
    console.log("\n🔗 Testing Supabase connection...")

    // Try to check if the table exists by querying it directly
    const { data: existingTable, error: checkError } = await supabaseAdmin
      .from("processing_checkpoints")
      .select("id")
      .limit(1)

    if (!checkError) {
      console.log("✅ processing_checkpoints table already exists!")
      console.log("🎉 Setup is already complete!")
      return
    }

    // If table doesn't exist (expected error), continue with creation
    if (checkError.code === "42P01") {
      console.log("✅ Connection successful! Table doesn't exist yet - will create it.")
    } else {
      console.error("❌ Unexpected connection error:", checkError.message)
      console.log("\n🔧 Please create the table manually:")
      showManualInstructions()
      return
    }

    // Try to create table using direct SQL
    console.log("\n📊 Creating processing_checkpoints table...")

    // Use REST API directly to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
      body: JSON.stringify({
        sql: `
          CREATE TABLE processing_checkpoints (
              id BIGSERIAL PRIMARY KEY,
              process_type VARCHAR(50) NOT NULL,
              process_id VARCHAR(100) NOT NULL,
              status VARCHAR(20) NOT NULL DEFAULT 'running',
              total_items INTEGER NOT NULL DEFAULT 0,
              processed_items INTEGER NOT NULL DEFAULT 0,
              failed_items INTEGER NOT NULL DEFAULT 0,
              current_batch INTEGER NOT NULL DEFAULT 0,
              last_processed_id BIGINT,
              last_processed_tokko_id BIGINT,
              checkpoint_data JSONB DEFAULT '{}',
              error_log TEXT[] DEFAULT '{}',
              started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              completed_at TIMESTAMP WITH TIME ZONE,
              UNIQUE(process_type, process_id)
          );
        `,
      }),
    })

    if (!response.ok) {
      console.log("⚠️ Direct SQL execution failed")
      console.log("\n🔧 Manual setup required:")
      showManualInstructions()
      return
    }

    console.log("✅ Table created successfully!")

    // Test the table
    console.log("\n🧪 Testing table functionality...")

    const { data: tableTest, error: tableError } = await supabaseAdmin
      .from("processing_checkpoints")
      .select("*")
      .limit(1)

    if (tableError) {
      console.error("❌ Table test failed:", tableError.message)
      return
    }

    console.log("✅ Table is working correctly!")

    console.log("\n🎉 Setup completed successfully!")
    console.log("==================================================")
    console.log("✅ processing_checkpoints table created")
    console.log("✅ Ready for image processing!")
    console.log("\n🚀 You can now:")
    console.log("   • Visit /cache-dashboard")
    console.log("   • Start image processing")
    console.log("   • Use checkpoint features")
  } catch (error) {
    console.error("❌ Setup failed:", error)
    console.log("\n🔧 Manual Setup Required:")
    showManualInstructions()
  }
}

function showManualInstructions() {
  console.log("==================================================")
  console.log("📋 MANUAL SETUP INSTRUCTIONS:")
  console.log("==================================================")
  console.log("1. Go to: https://supabase.com/dashboard")
  console.log("2. Select your project")
  console.log("3. Go to 'SQL Editor'")
  console.log("4. Create a new query")
  console.log("5. Paste this SQL:")
  console.log("")
  console.log("-- Copy everything below this line --")
  console.log(`CREATE TABLE processing_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    process_type VARCHAR(50) NOT NULL,
    process_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    current_batch INTEGER NOT NULL DEFAULT 0,
    last_processed_id BIGINT,
    last_processed_tokko_id BIGINT,
    checkpoint_data JSONB DEFAULT '{}',
    error_log TEXT[] DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(process_type, process_id)
);

-- Add performance indexes
CREATE INDEX idx_checkpoints_status ON processing_checkpoints(status);
CREATE INDEX idx_checkpoints_type_id ON processing_checkpoints(process_type, process_id);
CREATE INDEX idx_checkpoints_updated ON processing_checkpoints(updated_at DESC);`)
  console.log("")
  console.log("6. Click 'Run' to execute")
  console.log("7. Refresh your /cache-dashboard page")
  console.log("")
  console.log("🔗 Direct link: https://supabase.com/dashboard")
}

setupSupabaseTables()
