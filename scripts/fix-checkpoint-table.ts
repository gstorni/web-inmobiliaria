import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function fixCheckpointTable() {
  console.log("🔧 CHECKPOINT TABLE FIX UTILITY")
  console.log("=".repeat(50))

  const supabaseUrl = null

  if (supabaseUrl) {
    const projectId = supabaseUrl.split("//")[1].split(".")[0]
    console.log(`🌐 Your Supabase Dashboard: https://supabase.com/dashboard/project/${projectId}/sql`)
  }

  console.log("\n🎯 COMPLETE FIX SOLUTION")
  console.log("-".repeat(30))
  console.log("Copy and paste this COMPLETE SQL script into Supabase SQL Editor:")
  console.log("")

  const fixSQL = `-- COMPLETE CHECKPOINT TABLE FIX
-- This will drop and recreate the table with proper structure

-- Drop existing table if it exists (this will remove all data)
DROP TABLE IF EXISTS processing_checkpoints CASCADE;

-- Create the table with correct structure
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

-- Add performance indexes
CREATE INDEX idx_checkpoints_status ON processing_checkpoints(status);
CREATE INDEX idx_checkpoints_type_id ON processing_checkpoints(process_type, process_id);
CREATE INDEX idx_checkpoints_updated ON processing_checkpoints(updated_at DESC);
CREATE INDEX idx_checkpoints_status_updated ON processing_checkpoints(status, updated_at DESC);

-- Disable Row Level Security to avoid permission issues
ALTER TABLE processing_checkpoints DISABLE ROW LEVEL SECURITY;

-- Insert a test record to verify everything works
INSERT INTO processing_checkpoints (
    process_type, 
    process_id, 
    status, 
    total_items, 
    processed_items
) VALUES (
    'setup_test', 
    'test_' || extract(epoch from now()), 
    'completed', 
    1, 
    1
);

-- Verify the table works
SELECT 
    'Table created successfully!' as message,
    count(*) as record_count 
FROM processing_checkpoints;`

  console.log(fixSQL)

  // Save to file
  try {
    const fs = await import("fs")
    const filePath = resolve(process.cwd(), "fix-checkpoint-table.sql")
    fs.writeFileSync(filePath, fixSQL)
    console.log(`\n💾 SQL saved to: ${filePath}`)
  } catch (error) {
    console.log("\n⚠️ Could not save SQL file")
  }

  console.log("\n📋 STEPS TO FIX:")
  console.log("-".repeat(30))
  console.log("1. Go to your Supabase Dashboard (link above)")
  console.log("2. Go to SQL Editor")
  console.log("3. Create a new query")
  console.log("4. Copy and paste the SQL above")
  console.log("5. Click 'Run'")
  console.log("6. You should see 'Table created successfully!' message")
  console.log("7. Refresh your /cache-dashboard")

  console.log("\n⚠️ WARNING:")
  console.log("-".repeat(30))
  console.log("This will DELETE any existing checkpoint data!")
  console.log("Only run this if you're okay with losing current progress.")

  console.log("\n✅ AFTER RUNNING:")
  console.log("-".repeat(30))
  console.log("• No more setup messages")
  console.log("• Working Start Processing buttons")
  console.log("• Fast checkpoint queries")
  console.log("• No more timeout errors")
}

fixCheckpointTable().catch(console.error)
