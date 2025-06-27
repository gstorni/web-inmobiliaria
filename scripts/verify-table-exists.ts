import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function verifyTableExists() {
  console.log("🔍 Checking if processing_checkpoints table exists...")
  console.log("==================================================")

  try {
    // Import and create Supabase client
    const { createClient } = await import("@supabase/supabase-js")
    const supabaseUrl = null!
    const supabaseServiceKey = null!

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Try to query the table
    console.log("🔗 Testing table access...")

    const { data, error } = await supabaseAdmin.from("processing_checkpoints").select("*").limit(1)

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.log("❌ Table does NOT exist")
        console.log("💡 You need to create it manually in Supabase")
        console.log("\n📋 Steps:")
        console.log("1. Go to https://supabase.com/dashboard")
        console.log("2. Select your project")
        console.log("3. Go to SQL Editor")
        console.log("4. Run this SQL:")
        console.log(`
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

CREATE INDEX idx_checkpoints_status ON processing_checkpoints(status);
CREATE INDEX idx_checkpoints_type_id ON processing_checkpoints(process_type, process_id);
CREATE INDEX idx_checkpoints_updated ON processing_checkpoints(updated_at DESC);
        `)
        return false
      } else {
        console.error("❌ Other database error:", error.message)
        return false
      }
    }

    console.log("✅ Table EXISTS and is accessible!")
    console.log(`📊 Current records: ${data?.length || 0}`)

    // Test inserting a dummy record
    console.log("\n🧪 Testing table functionality...")

    const testId = `test_${Date.now()}`
    const { error: insertError } = await supabaseAdmin.from("processing_checkpoints").insert({
      process_type: "test",
      process_id: testId,
      status: "completed",
      total_items: 1,
      processed_items: 1,
    })

    if (insertError) {
      console.error("❌ Insert test failed:", insertError.message)
      return false
    }

    // Clean up test record
    await supabaseAdmin.from("processing_checkpoints").delete().eq("process_id", testId)

    console.log("✅ Table is fully functional!")
    console.log("🎉 Your checkpoint system is ready to use!")

    return true
  } catch (error) {
    console.error("❌ Verification failed:", error)
    return false
  }
}

verifyTableExists()
