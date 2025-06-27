import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

interface DiagnosticResult {
  step: string
  status: "success" | "error" | "warning"
  message: string
  details?: any
}

async function comprehensiveCheckpointDiagnosis() {
  console.log("🔍 COMPREHENSIVE CHECKPOINT SYSTEM DIAGNOSIS")
  console.log("=".repeat(60))

  const results: DiagnosticResult[] = []

  // Step 1: Environment Variables Check
  console.log("\n📋 STEP 1: Environment Variables Analysis")
  console.log("-".repeat(40))

  const supabaseUrl = null
  const supabaseAnonKey = null
  const supabaseServiceKey = null

  if (!supabaseUrl) {
    results.push({
      step: "env_check",
      status: "error",
      message: "NEXT_PUBLIC_SUPABASE_URL is missing",
    })
    console.log("❌ NEXT_PUBLIC_SUPABASE_URL: Missing")
  } else {
    results.push({
      step: "env_check",
      status: "success",
      message: "NEXT_PUBLIC_SUPABASE_URL is set",
    })
    console.log(`✅ NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`)
  }

  if (!supabaseAnonKey) {
    results.push({
      step: "env_check",
      status: "error",
      message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing",
    })
    console.log("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY: Missing")
  } else {
    results.push({
      step: "env_check",
      status: "success",
      message: "NEXT_PUBLIC_SUPABASE_ANON_KEY is set",
    })
    console.log(`✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey.substring(0, 20)}...`)
  }

  if (!supabaseServiceKey) {
    results.push({
      step: "env_check",
      status: "error",
      message: "SUPABASE_SERVICE_ROLE_KEY is missing",
    })
    console.log("❌ SUPABASE_SERVICE_ROLE_KEY: Missing")
  } else {
    results.push({
      step: "env_check",
      status: "success",
      message: "SUPABASE_SERVICE_ROLE_KEY is set",
    })
    console.log(`✅ SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey.substring(0, 20)}...`)
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.log("\n🚨 CRITICAL: Missing environment variables. Cannot proceed.")
    return results
  }

  // Step 2: Basic Connectivity Test
  console.log("\n🌐 STEP 2: Basic Network Connectivity")
  console.log("-".repeat(40))

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    })

    if (response.ok) {
      results.push({
        step: "connectivity",
        status: "success",
        message: "Basic HTTP connectivity successful",
      })
      console.log("✅ Basic HTTP connectivity: SUCCESS")
    } else {
      results.push({
        step: "connectivity",
        status: "error",
        message: `HTTP connectivity failed: ${response.status} ${response.statusText}`,
        details: { status: response.status, statusText: response.statusText },
      })
      console.log(`❌ Basic HTTP connectivity: FAILED (${response.status} ${response.statusText})`)
    }
  } catch (error: any) {
    results.push({
      step: "connectivity",
      status: "error",
      message: `Network connectivity failed: ${error.message}`,
      details: error,
    })
    console.log(`❌ Basic HTTP connectivity: FAILED (${error.message})`)
  }

  // Step 3: Supabase Client Creation
  console.log("\n🔧 STEP 3: Supabase Client Creation")
  console.log("-".repeat(40))

  let supabaseAdmin: any = null
  let supabaseClient: any = null

  try {
    const { createClient } = await import("@supabase/supabase-js")

    // Create admin client
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    console.log("✅ Admin client created successfully")

    // Create regular client
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
    console.log("✅ Regular client created successfully")

    results.push({
      step: "client_creation",
      status: "success",
      message: "Supabase clients created successfully",
    })
  } catch (error: any) {
    results.push({
      step: "client_creation",
      status: "error",
      message: `Client creation failed: ${error.message}`,
      details: error,
    })
    console.log(`❌ Client creation: FAILED (${error.message})`)
    return results
  }

  // Step 4: Database Connection Test
  console.log("\n🗄️ STEP 4: Database Connection Test")
  console.log("-".repeat(40))

  try {
    // Test with a simple query that should always work
    const { data, error } = await supabaseAdmin
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .limit(1)

    if (error) {
      results.push({
        step: "db_connection",
        status: "error",
        message: `Database connection failed: ${error.message}`,
        details: error,
      })
      console.log(`❌ Database connection: FAILED (${error.message})`)
    } else {
      results.push({
        step: "db_connection",
        status: "success",
        message: "Database connection successful",
      })
      console.log("✅ Database connection: SUCCESS")
    }
  } catch (error: any) {
    results.push({
      step: "db_connection",
      status: "error",
      message: `Database connection exception: ${error.message}`,
      details: error,
    })
    console.log(`❌ Database connection: EXCEPTION (${error.message})`)
  }

  // Step 5: Check Existing Tables
  console.log("\n📊 STEP 5: Existing Tables Analysis")
  console.log("-".repeat(40))

  try {
    const { data: tables, error } = await supabaseAdmin
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")

    if (error) {
      results.push({
        step: "table_analysis",
        status: "error",
        message: `Failed to list tables: ${error.message}`,
        details: error,
      })
      console.log(`❌ Table listing: FAILED (${error.message})`)
    } else {
      const tableNames = tables?.map((t) => t.table_name) || []
      const hasCheckpointTable = tableNames.includes("processing_checkpoints")

      results.push({
        step: "table_analysis",
        status: hasCheckpointTable ? "success" : "warning",
        message: `Found ${tableNames.length} tables. Checkpoint table exists: ${hasCheckpointTable}`,
        details: { tables: tableNames, hasCheckpointTable },
      })

      console.log(`📋 Found ${tableNames.length} existing tables:`)
      tableNames.forEach((name) => console.log(`   - ${name}`))
      console.log(`🎯 processing_checkpoints table: ${hasCheckpointTable ? "✅ EXISTS" : "❌ MISSING"}`)
    }
  } catch (error: any) {
    results.push({
      step: "table_analysis",
      status: "error",
      message: `Table analysis exception: ${error.message}`,
      details: error,
    })
    console.log(`❌ Table analysis: EXCEPTION (${error.message})`)
  }

  // Step 6: Direct Table Query Test
  console.log("\n🔍 STEP 6: Direct Table Query Test")
  console.log("-".repeat(40))

  try {
    const { data, error } = await supabaseAdmin.from("processing_checkpoints").select("*").limit(1)

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        results.push({
          step: "table_query",
          status: "warning",
          message: "Table does not exist (expected if not created yet)",
          details: error,
        })
        console.log("⚠️ Table query: TABLE DOES NOT EXIST")
      } else {
        results.push({
          step: "table_query",
          status: "error",
          message: `Table query failed: ${error.message}`,
          details: error,
        })
        console.log(`❌ Table query: FAILED (${error.message})`)
      }
    } else {
      results.push({
        step: "table_query",
        status: "success",
        message: `Table exists and accessible. Found ${data?.length || 0} records`,
        details: { recordCount: data?.length || 0 },
      })
      console.log(`✅ Table query: SUCCESS (${data?.length || 0} records)`)
    }
  } catch (error: any) {
    results.push({
      step: "table_query",
      status: "error",
      message: `Table query exception: ${error.message}`,
      details: error,
    })
    console.log(`❌ Table query: EXCEPTION (${error.message})`)
  }

  // Step 7: Table Creation Attempt
  console.log("\n🏗️ STEP 7: Table Creation Attempt")
  console.log("-".repeat(40))

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS processing_checkpoints (
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
  `

  // Method 1: Try RPC approach
  console.log("🔧 Attempting Method 1: RPC execution...")
  try {
    const { data, error } = await supabaseAdmin.rpc("exec", { sql: createTableSQL })

    if (error) {
      results.push({
        step: "table_creation_rpc",
        status: "error",
        message: `RPC table creation failed: ${error.message}`,
        details: error,
      })
      console.log(`❌ RPC Method: FAILED (${error.message})`)
    } else {
      results.push({
        step: "table_creation_rpc",
        status: "success",
        message: "RPC table creation successful",
      })
      console.log("✅ RPC Method: SUCCESS")
    }
  } catch (error: any) {
    results.push({
      step: "table_creation_rpc",
      status: "error",
      message: `RPC table creation exception: ${error.message}`,
      details: error,
    })
    console.log(`❌ RPC Method: EXCEPTION (${error.message})`)
  }

  // Method 2: Try direct REST API
  console.log("🔧 Attempting Method 2: Direct REST API...")
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql: createTableSQL }),
    })

    if (response.ok) {
      results.push({
        step: "table_creation_rest",
        status: "success",
        message: "REST API table creation successful",
      })
      console.log("✅ REST API Method: SUCCESS")
    } else {
      const errorText = await response.text()
      results.push({
        step: "table_creation_rest",
        status: "error",
        message: `REST API table creation failed: ${response.status} ${response.statusText}`,
        details: { status: response.status, statusText: response.statusText, body: errorText },
      })
      console.log(`❌ REST API Method: FAILED (${response.status} ${response.statusText})`)
    }
  } catch (error: any) {
    results.push({
      step: "table_creation_rest",
      status: "error",
      message: `REST API table creation exception: ${error.message}`,
      details: error,
    })
    console.log(`❌ REST API Method: EXCEPTION (${error.message})`)
  }

  // Step 8: Final Verification
  console.log("\n✅ STEP 8: Final Verification")
  console.log("-".repeat(40))

  try {
    const { data, error } = await supabaseAdmin.from("processing_checkpoints").select("*").limit(1)

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        results.push({
          step: "final_verification",
          status: "error",
          message: "Table still does not exist after creation attempts",
        })
        console.log("❌ Final verification: TABLE STILL MISSING")
      } else {
        results.push({
          step: "final_verification",
          status: "error",
          message: `Final verification failed: ${error.message}`,
          details: error,
        })
        console.log(`❌ Final verification: FAILED (${error.message})`)
      }
    } else {
      results.push({
        step: "final_verification",
        status: "success",
        message: "Table successfully created and accessible",
      })
      console.log("✅ Final verification: TABLE EXISTS AND ACCESSIBLE")
    }
  } catch (error: any) {
    results.push({
      step: "final_verification",
      status: "error",
      message: `Final verification exception: ${error.message}`,
      details: error,
    })
    console.log(`❌ Final verification: EXCEPTION (${error.message})`)
  }

  // Summary Report
  console.log("\n📊 DIAGNOSIS SUMMARY")
  console.log("=".repeat(60))

  const successCount = results.filter((r) => r.status === "success").length
  const errorCount = results.filter((r) => r.status === "error").length
  const warningCount = results.filter((r) => r.status === "warning").length

  console.log(`✅ Successful steps: ${successCount}`)
  console.log(`❌ Failed steps: ${errorCount}`)
  console.log(`⚠️ Warning steps: ${warningCount}`)

  console.log("\n🔍 DETAILED RESULTS:")
  results.forEach((result, index) => {
    const icon = result.status === "success" ? "✅" : result.status === "error" ? "❌" : "⚠️"
    console.log(`${index + 1}. ${icon} ${result.step}: ${result.message}`)
    if (result.details && result.status === "error") {
      console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`)
    }
  })

  // Recommendations
  console.log("\n💡 RECOMMENDATIONS:")
  console.log("-".repeat(40))

  const hasTableCreationErrors = results.some((r) => r.step.includes("table_creation") && r.status === "error")

  const hasConnectivityIssues = results.some(
    (r) => (r.step === "connectivity" || r.step === "db_connection") && r.status === "error",
  )

  if (hasConnectivityIssues) {
    console.log("🚨 CRITICAL: Fix connectivity issues first")
    console.log("   - Check your internet connection")
    console.log("   - Verify Supabase project is active")
    console.log("   - Check firewall settings")
  } else if (hasTableCreationErrors) {
    console.log("🔧 MANUAL SETUP REQUIRED:")
    console.log("   1. Go to https://supabase.com/dashboard")
    console.log("   2. Select your project")
    console.log("   3. Go to SQL Editor")
    console.log("   4. Run the SQL script manually")
    console.log("   5. This bypasses any RPC/API limitations")
  } else {
    console.log("🎉 System appears to be working correctly!")
  }

  return results
}

// Run the diagnosis
comprehensiveCheckpointDiagnosis().catch(console.error)
