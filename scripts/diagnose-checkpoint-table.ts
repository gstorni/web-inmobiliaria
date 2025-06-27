import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function diagnoseCheckpointTable() {
  console.log("🔍 COMPREHENSIVE CHECKPOINT TABLE DIAGNOSIS")
  console.log("=".repeat(60))

  try {
    const { supabase } = await import("@/lib/supabase-client")

    // Test 1: Check if table exists at all
    console.log("\n📋 TEST 1: Table Existence Check")
    console.log("-".repeat(40))

    try {
      const { data: tableCheck, error: tableError } = await supabase
        .from("processing_checkpoints")
        .select("count(*)")
        .single()

      if (tableError) {
        if (tableError.code === "42P01" || tableError.message.includes("does not exist")) {
          console.log("❌ TABLE DOES NOT EXIST")
          console.log("   The processing_checkpoints table has never been created")

          console.log("\n🔧 SOLUTION: Create the table manually")
          console.log("1. Go to: https://supabase.com/dashboard")
          console.log("2. Select your project")
          console.log("3. Go to SQL Editor")
          console.log("4. Run this SQL:")
          console.log("")
          console.log(getCreateTableSQL())
          return
        } else {
          console.log(`❌ TABLE ACCESS ERROR: ${tableError.message}`)
          console.log(`   Code: ${tableError.code}`)
          console.log(`   This suggests permission or configuration issues`)
        }
      } else {
        console.log("✅ TABLE EXISTS and is accessible")
        console.log(`   Current record count: ${tableCheck?.count || 0}`)
      }
    } catch (error: any) {
      console.log(`❌ CRITICAL ERROR: ${error.message}`)
      return
    }

    // Test 2: Check table structure
    console.log("\n📊 TEST 2: Table Structure Analysis")
    console.log("-".repeat(40))

    try {
      // Try to get table info using information_schema
      const { data: columns, error: columnsError } = await supabase.rpc("get_table_columns", {
        table_name: "processing_checkpoints",
      })

      if (columnsError) {
        console.log("⚠️ Cannot check table structure via RPC")
        console.log("   This is normal - RPC functions may not be available")

        // Alternative: Try a simple select to see what columns exist
        const { data: sampleData, error: sampleError } = await supabase
          .from("processing_checkpoints")
          .select("*")
          .limit(1)

        if (sampleError) {
          console.log(`❌ Cannot query table: ${sampleError.message}`)
        } else {
          console.log("✅ Table structure appears correct")
          if (sampleData && sampleData.length > 0) {
            console.log("   Sample columns:", Object.keys(sampleData[0]).join(", "))
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️ Structure check failed: ${error.message}`)
    }

    // Test 3: Test basic CRUD operations
    console.log("\n🧪 TEST 3: CRUD Operations Test")
    console.log("-".repeat(40))

    // Insert test
    const testRecord = {
      process_type: "diagnostic_test",
      process_id: `test_${Date.now()}`,
      status: "running",
      total_items: 10,
      processed_items: 0,
      failed_items: 0,
      current_batch: 1,
    }

    try {
      const { data: insertData, error: insertError } = await supabase
        .from("processing_checkpoints")
        .insert([testRecord])
        .select()

      if (insertError) {
        console.log(`❌ INSERT FAILED: ${insertError.message}`)
        console.log(`   Code: ${insertError.code}`)
        console.log(`   Details: ${insertError.details}`)

        if (insertError.message.includes("violates")) {
          console.log("   🔧 LIKELY ISSUE: Table constraints or data type mismatch")
        }
      } else {
        console.log("✅ INSERT successful")
        const recordId = insertData?.[0]?.id
        console.log(`   Record ID: ${recordId}`)

        // Update test
        if (recordId) {
          const { data: updateData, error: updateError } = await supabase
            .from("processing_checkpoints")
            .update({ processed_items: 5, status: "paused" })
            .eq("id", recordId)
            .select()

          if (updateError) {
            console.log(`❌ UPDATE FAILED: ${updateError.message}`)
          } else {
            console.log("✅ UPDATE successful")
          }

          // Delete test (cleanup)
          const { error: deleteError } = await supabase.from("processing_checkpoints").delete().eq("id", recordId)

          if (deleteError) {
            console.log(`❌ DELETE FAILED: ${deleteError.message}`)
            console.log(`   ⚠️ Test record ${recordId} may need manual cleanup`)
          } else {
            console.log("✅ DELETE successful (cleanup completed)")
          }
        }
      }
    } catch (error: any) {
      console.log(`❌ CRUD TEST EXCEPTION: ${error.message}`)
    }

    // Test 4: Check permissions
    console.log("\n🔐 TEST 4: Permissions Check")
    console.log("-".repeat(40))

    try {
      // Test with anon key
      const { createClient } = await import("@supabase/supabase-js")
      const anonClient = createClient(/* Supabase URL removed */!, /* Supabase key removed */!)

      const { data: anonData, error: anonError } = await anonClient
        .from("processing_checkpoints")
        .select("count(*)")
        .single()

      if (anonError) {
        console.log(`❌ ANON KEY ACCESS FAILED: ${anonError.message}`)
        console.log("   🔧 ISSUE: RLS (Row Level Security) may be blocking access")
        console.log("   SOLUTION: Disable RLS or add proper policies")
      } else {
        console.log("✅ ANON KEY ACCESS successful")
      }

      // Test with service key
      const serviceClient = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!)

      const { data: serviceData, error: serviceError } = await serviceClient
        .from("processing_checkpoints")
        .select("count(*)")
        .single()

      if (serviceError) {
        console.log(`❌ SERVICE KEY ACCESS FAILED: ${serviceError.message}`)
      } else {
        console.log("✅ SERVICE KEY ACCESS successful")
      }
    } catch (error: any) {
      console.log(`❌ PERMISSIONS TEST FAILED: ${error.message}`)
    }

    // Test 5: API endpoint test
    console.log("\n🌐 TEST 5: API Endpoint Test")
    console.log("-".repeat(40))

    try {
      const response = await fetch("http://localhost:3000/api/checkpoints/active")
      const apiData = await response.json()

      console.log(`📡 Response Status: ${response.status}`)
      console.log(`📊 Response Data:`, JSON.stringify(apiData, null, 2))

      if (apiData.success) {
        console.log("✅ API ENDPOINT working")
        if (apiData.setupRequired) {
          console.log("⚠️ API reports setup still required")
        }
      } else {
        console.log("❌ API ENDPOINT failed")
      }
    } catch (error: any) {
      console.log(`❌ API TEST FAILED: ${error.message}`)
      console.log("   Make sure Next.js dev server is running: npm run dev")
    }

    // Final recommendations
    console.log("\n💡 DIAGNOSIS SUMMARY & RECOMMENDATIONS")
    console.log("=".repeat(60))
    console.log("Based on the tests above, here are the likely issues and solutions:")
    console.log("")
    console.log("🔧 COMMON ISSUES:")
    console.log("1. Table doesn't exist → Run the CREATE TABLE SQL")
    console.log("2. RLS blocking access → Disable RLS or add policies")
    console.log("3. Wrong data types → Recreate table with correct schema")
    console.log("4. Permission issues → Check service role key")
    console.log("5. Network timeouts → Add indexes for performance")
  } catch (error: any) {
    console.error("❌ DIAGNOSIS FAILED:", error.message)
    console.error("Details:", error)
  }
}

function getCreateTableSQL(): string {
  return `-- Create processing_checkpoints table
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

-- Add indexes for performance
CREATE INDEX idx_checkpoints_status ON processing_checkpoints(status);
CREATE INDEX idx_checkpoints_type_id ON processing_checkpoints(process_type, process_id);
CREATE INDEX idx_checkpoints_updated ON processing_checkpoints(updated_at DESC);

-- Disable RLS (Row Level Security) for this table
ALTER TABLE processing_checkpoints DISABLE ROW LEVEL SECURITY;`
}

diagnoseCheckpointTable().catch(console.error)
