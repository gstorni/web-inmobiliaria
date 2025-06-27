#!/usr/bin/env npx tsx

// Load environment variables from .env.local
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const supabase = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!)

async function setupDatabaseAndSync() {
  console.log("🚀 SETTING UP DATABASE AND SYNCING PROPERTIES")
  console.log("=".repeat(60))

  // Step 1: Verify database schema
  await verifyDatabaseSchema()

  // Step 2: Sync properties from Tokko API
  await syncPropertiesFromAPI()

  // Step 3: Verify the setup worked
  await verifySetup()

  console.log("\n✅ Setup complete!")
}

async function verifyDatabaseSchema() {
  console.log("\n📋 VERIFYING DATABASE SCHEMA")
  console.log("-".repeat(40))

  const tables = ["properties_cache", "property_images", "process_checkpoints"]

  for (const tableName of tables) {
    try {
      const { data, error } = await supabase.from(tableName).select("*").limit(1)

      if (error) {
        console.log(`❌ Table '${tableName}' issue: ${error.message}`)
        if (error.message.includes("does not exist")) {
          console.log(`   SOLUTION: Run the SQL schema script in Supabase dashboard`)
          console.log(`   File: scripts/create-complete-schema.sql`)
        }
      } else {
        console.log(`✅ Table '${tableName}' exists and accessible`)
      }
    } catch (error: any) {
      console.log(`❌ Error checking table '${tableName}': ${error.message}`)
    }
  }

  // Check the view
  try {
    const { data, error } = await supabase.from("properties_with_images").select("tokko_id").limit(1)

    if (error) {
      console.log(`❌ View 'properties_with_images' issue: ${error.message}`)
    } else {
      console.log(`✅ View 'properties_with_images' exists and accessible`)
    }
  } catch (error: any) {
    console.log(`❌ Error checking view: ${error.message}`)
  }
}

async function syncPropertiesFromAPI() {
  console.log("\n🔄 SYNCING PROPERTIES FROM TOKKO API")
  console.log("-".repeat(40))

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  try {
    console.log(`Calling sync API at: ${baseUrl}/api/properties/sync`)

    const response = await fetch(`${baseUrl}/api/properties/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "full",
        limit: 20, // Start with a small number
      }),
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`✅ Sync initiated: ${result.message}`)
      console.log(`   Process ID: ${result.processId}`)

      // Wait a bit for sync to start
      console.log("   Waiting 5 seconds for sync to process...")
      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Check progress
      await checkSyncProgress()
    } else {
      const errorText = await response.text()
      console.log(`❌ Sync failed: ${response.status} ${response.statusText}`)
      console.log(`   Error: ${errorText}`)
    }
  } catch (error: any) {
    console.log(`❌ Sync request failed: ${error.message}`)
    console.log(`   Make sure your Next.js server is running: npm run dev`)
  }
}

async function checkSyncProgress() {
  console.log("\n📊 CHECKING SYNC PROGRESS")
  console.log("-".repeat(40))

  try {
    // Check how many properties we have now
    const { count, error } = await supabase.from("properties_cache").select("*", { count: "exact", head: true })

    if (error) {
      console.log(`❌ Error checking properties count: ${error.message}`)
    } else {
      console.log(`✅ Properties in database: ${count || 0}`)

      if (count && count > 0) {
        // Get sample properties
        const { data: sampleProps, error: sampleError } = await supabase
          .from("properties_cache")
          .select("tokko_id, title, sync_status")
          .limit(3)

        if (!sampleError && sampleProps) {
          console.log("   Sample properties:")
          sampleProps.forEach((prop, index) => {
            console.log(`   ${index + 1}. ID: ${prop.tokko_id} | ${prop.title} | Status: ${prop.sync_status}`)
          })
        }
      }
    }

    // Check active processes
    const { data: activeProcesses, error: processError } = await supabase
      .from("process_checkpoints")
      .select("process_id, process_type, status, processed_items, total_items")
      .eq("status", "running")

    if (!processError && activeProcesses && activeProcesses.length > 0) {
      console.log("   Active sync processes:")
      activeProcesses.forEach((proc) => {
        console.log(`   - ${proc.process_type}: ${proc.processed_items}/${proc.total_items} items`)
      })
    }
  } catch (error: any) {
    console.log(`❌ Error checking progress: ${error.message}`)
  }
}

async function verifySetup() {
  console.log("\n🔍 VERIFYING SETUP")
  console.log("-".repeat(40))

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // Get a property ID to test with
  const { data: testProp, error: testError } = await supabase
    .from("properties_cache")
    .select("tokko_id")
    .limit(1)
    .single()

  if (testError || !testProp) {
    console.log(`❌ No properties available for testing`)
    console.log(`   The sync might still be running, or there might be an issue`)
    return
  }

  const testId = testProp.tokko_id
  console.log(`Testing with property ID: ${testId}`)

  try {
    const response = await fetch(`${baseUrl}/api/properties/${testId}`)

    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        console.log(`✅ Property API working: ${data.property.title}`)
        console.log(`   Cache source: ${data.meta.cacheSource}`)
        console.log(`   Response time: ${data.meta.responseTime}ms`)
      } else {
        console.log(`❌ Property API returned error: ${data.message}`)
      }
    } else {
      console.log(`❌ Property API failed: ${response.status} ${response.statusText}`)
    }
  } catch (error: any) {
    console.log(`❌ Property API test failed: ${error.message}`)
  }

  // Test the properties list page
  try {
    const listResponse = await fetch(`${baseUrl}/api/properties/search?limit=5`)

    if (listResponse.ok) {
      const listData = await listResponse.json()
      console.log(`✅ Properties search API working: ${listData.total} total properties`)
    } else {
      console.log(`❌ Properties search API failed: ${listResponse.status}`)
    }
  } catch (error: any) {
    console.log(`❌ Properties search test failed: ${error.message}`)
  }
}

// Run the setup
setupDatabaseAndSync().catch(console.error)
