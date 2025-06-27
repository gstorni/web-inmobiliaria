#!/usr/bin/env npx tsx

// Load environment variables from .env.local
import { config } from "dotenv"
import { resolve } from "path"
import { existsSync } from "fs"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔧 SIMPLE PROPERTY INVESTIGATION")
console.log("=".repeat(50))
console.log(`Current working directory: ${process.cwd()}`)
console.log(`Looking for .env.local at: ${resolve(process.cwd(), ".env.local")}`)

// Check if .env.local exists
const envPath = resolve(process.cwd(), ".env.local")
if (!existsSync(envPath)) {
  console.error(`❌ .env.local file not found at: ${envPath}`)
  console.error(`   Please create the .env.local file with your environment variables`)
  process.exit(1)
}
console.log(`✅ .env.local file found`)

// Verify required environment variables
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKKO_API_KEY",
]

console.log("=".repeat(50))

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName])
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(", ")}`)
  console.error(`   Please check your .env.local file`)
  process.exit(1)
}

console.log("✅ All required environment variables are set")
console.log(`   Supabase URL: ${/* Supabase URL removed */}`)
console.log(`   Tokko API Key: ${process.env.TOKKO_API_KEY ? "***" + process.env.TOKKO_API_KEY.slice(-4) : "Not set"}`)
console.log(`   Redis URL: ${process.env.REDIS_URL ? "Set" : "Not set (optional)"}`)

// Import only Supabase client directly

const supabase = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!)

async function investigatePropertyIssues() {
  console.log("\n🔍 INVESTIGATING PROPERTY ISSUES")
  console.log("=".repeat(60))

  // Step 1: Check database connection
  await checkDatabaseConnection()

  // Step 2: Check if properties table exists and has data
  await checkPropertiesTable()

  // Step 3: Check if properties_with_images view exists
  await checkPropertiesView()

  // Step 4: Test API endpoints directly
  await testAPIEndpoints()

  // Step 5: Check for common issues
  await checkCommonIssues()

  console.log("\n✅ Investigation complete!")
}

async function checkDatabaseConnection() {
  console.log("\n📦 CHECKING DATABASE CONNECTION")
  console.log("-".repeat(40))

  try {
    const { data, error } = await supabase.from("properties_cache").select("count", { count: "exact", head: true })

    if (error) {
      console.log(`❌ Database connection failed: ${error.message}`)
      if (error.message.includes("relation") && error.message.includes("does not exist")) {
        console.log(`   ISSUE: properties_cache table doesn't exist`)
        console.log(`   SOLUTION: Run the database setup script`)
      }
    } else {
      console.log(`✅ Database connection successful`)
      console.log(`   Total properties in cache: ${data || 0}`)
    }
  } catch (error: any) {
    console.log(`❌ Database connection exception: ${error.message}`)
  }
}

async function checkPropertiesTable() {
  console.log("\n📊 CHECKING PROPERTIES TABLE")
  console.log("-".repeat(40))

  try {
    // Check if table exists by trying to get its structure
    const { data: tableInfo, error: tableError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_name", "properties_cache")

    if (tableError) {
      console.log(`❌ Could not check table existence: ${tableError.message}`)
      return
    }

    if (!tableInfo || tableInfo.length === 0) {
      console.log(`❌ properties_cache table does not exist`)
      console.log(`   SOLUTION: Create the table using the setup script`)
      return
    }

    console.log(`✅ properties_cache table exists`)

    // Get sample data
    const { data: sampleData, error: dataError } = await supabase
      .from("properties_cache")
      .select("tokko_id, title, sync_status, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    if (dataError) {
      console.log(`❌ Error fetching sample data: ${dataError.message}`)
    } else if (sampleData && sampleData.length > 0) {
      console.log(`✅ Found ${sampleData.length} sample properties:`)
      sampleData.forEach((prop, index) => {
        console.log(`   ${index + 1}. ID: ${prop.tokko_id} | ${prop.title} | Status: ${prop.sync_status}`)
      })
    } else {
      console.log(`❌ No properties found in cache`)
      console.log(`   SOLUTION: Run property sync to populate the database`)
    }
  } catch (error: any) {
    console.log(`❌ Table check exception: ${error.message}`)
  }
}

async function checkPropertiesView() {
  console.log("\n👁️ CHECKING PROPERTIES VIEW")
  console.log("-".repeat(40))

  try {
    // Check if view exists
    const { data: viewInfo, error: viewError } = await supabase
      .from("information_schema.views")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_name", "properties_with_images")

    if (viewError) {
      console.log(`❌ Could not check view existence: ${viewError.message}`)
      return
    }

    if (!viewInfo || viewInfo.length === 0) {
      console.log(`❌ properties_with_images view does not exist`)
      console.log(`   SOLUTION: Create the view using the setup script`)
      return
    }

    console.log(`✅ properties_with_images view exists`)

    // Test the view
    const { data: viewData, error: viewDataError } = await supabase
      .from("properties_with_images")
      .select("tokko_id, title")
      .limit(3)

    if (viewDataError) {
      console.log(`❌ Error querying view: ${viewDataError.message}`)
    } else if (viewData && viewData.length > 0) {
      console.log(`✅ View is working, found ${viewData.length} properties`)
    } else {
      console.log(`⚠️ View exists but returned no data`)
    }
  } catch (error: any) {
    console.log(`❌ View check exception: ${error.message}`)
  }
}

async function testAPIEndpoints() {
  console.log("\n🔗 TESTING API ENDPOINTS")
  console.log("-".repeat(40))

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // Test if server is running
  try {
    console.log(`Testing server at: ${baseUrl}`)
    const healthResponse = await fetch(`${baseUrl}/api/health`).catch(() => null)

    if (!healthResponse) {
      console.log(`❌ Server not responding at ${baseUrl}`)
      console.log(`   Make sure your Next.js server is running: npm run dev`)
      return
    }

    console.log(`✅ Server is responding`)

    // Test properties API with a sample ID
    const testIds = [1, 100, 1000]

    for (const testId of testIds) {
      try {
        console.log(`   Testing /api/properties/${testId}...`)
        const response = await fetch(`${baseUrl}/api/properties/${testId}`)

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            console.log(`   ✅ Property ${testId} found: ${data.property?.title}`)
            break
          } else {
            console.log(`   ❌ Property ${testId} not found: ${data.message}`)
          }
        } else {
          console.log(`   ❌ API error ${response.status}: ${response.statusText}`)
        }
      } catch (error: any) {
        console.log(`   ❌ Request failed: ${error.message}`)
      }
    }
  } catch (error: any) {
    console.log(`❌ API test exception: ${error.message}`)
  }
}

async function checkCommonIssues() {
  console.log("\n🔧 CHECKING COMMON ISSUES")
  console.log("-".repeat(40))

  // Check TOKKO_API_KEY format
  const tokkoKey = process.env.TOKKO_API_KEY
  if (tokkoKey) {
    if (tokkoKey.length < 10) {
      console.log(`❌ TOKKO_API_KEY seems too short (${tokkoKey.length} characters)`)
      console.log(`   Expected: A longer API key from TokkoBroker`)
    } else if (!tokkoKey.match(/^[a-zA-Z0-9]+$/)) {
      console.log(`❌ TOKKO_API_KEY contains invalid characters`)
      console.log(`   Expected: Alphanumeric characters only`)
    } else {
      console.log(`✅ TOKKO_API_KEY format looks valid`)
    }
  }

  // Check Supabase URL format
  const supabaseUrl = null
  if (supabaseUrl && !supabaseUrl.includes("supabase.co")) {
    console.log(`❌ NEXT_PUBLIC_SUPABASE_URL doesn't look like a Supabase URL`)
    console.log(`   Expected: https://your-project.supabase.co`)
  } else {
    console.log(`✅ Supabase URL format looks valid`)
  }

  // Check if Redis is configured
  const redisConfigured = process.env.REDIS_URL || process.env.KV_REST_API_URL || process.env.REDIS_HOST
  if (!redisConfigured) {
    console.log(`⚠️ Redis not configured - caching will be limited to database only`)
    console.log(`   Consider setting up Redis for better performance`)
  } else {
    console.log(`✅ Redis configuration detected`)
  }

  console.log("\n💡 RECOMMENDATIONS:")
  console.log("1. If no properties in database: Run property sync")
  console.log("2. If API endpoints fail: Check if Next.js server is running")
  console.log("3. If database issues: Verify Supabase credentials and table setup")
  console.log("4. If Tokko API issues: Verify API key format and permissions")
}

// Run the investigation
investigatePropertyIssues().catch(console.error)
