#!/usr/bin/env npx tsx

// Load environment variables from .env.local
import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local file
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔧 ENVIRONMENT VARIABLES CHECK")
console.log("=".repeat(50))
console.log(`Current working directory: ${process.cwd()}`)
console.log(`Looking for .env.local at: ${resolve(process.cwd(), ".env.local")}`)

// Check if .env.local exists
import { existsSync } from "fs"
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

import { hybridCacheService } from "../lib/hybrid-cache-service"
import { tokkoClient } from "../lib/tokko-client"

interface PropertyInvestigation {
  step: string
  success: boolean
  data?: any
  error?: string
  timing?: number
}

async function investigatePropertyNotFound() {
  console.log("\n🔍 INVESTIGATING PROPERTY NOT FOUND ERROR")
  console.log("=".repeat(60))

  const results: PropertyInvestigation[] = []

  // Test with a few different property IDs
  const testPropertyIds = [1, 100, 1000, 12345, 999999]

  for (const propertyId of testPropertyIds) {
    console.log(`\n🏠 Testing Property ID: ${propertyId}`)
    console.log("-".repeat(40))

    // Step 1: Check if property exists in Supabase properties_cache
    await checkSupabaseCache(propertyId, results)

    // Step 2: Check if property exists in properties_with_images view
    await checkSupabaseView(propertyId, results)

    // Step 3: Check Redis cache
    await checkRedisCache(propertyId, results)

    // Step 4: Test hybrid cache service
    await checkHybridCacheService(propertyId, results)

    // Step 5: Test direct Tokko API
    await checkTokkoAPI(propertyId, results)

    // Step 6: Test the API endpoint
    await checkAPIEndpoint(propertyId, results)

    // If we found data in any step, break to analyze
    if (results.some((r) => r.success && r.data)) {
      console.log(`✅ Found working property ID: ${propertyId}`)
      break
    }
  }

  // Step 7: Get sample of existing properties
  await getSampleProperties(results)

  // Step 8: Test the actual page route
  await testPropertyPageRoute(results)

  // Analysis and recommendations
  analyzeResults(results)
}

async function checkSupabaseCache(propertyId: number, results: PropertyInvestigation[]) {
  const startTime = Date.now()
  try {
    console.log(`📦 Checking Supabase properties_cache for ID ${propertyId}...`)

    const { data, error, count } = await supabase
      .from("properties_cache")
      .select("*", { count: "exact" })
      .eq("tokko_id", propertyId)
      .single()

    const timing = Date.now() - startTime

    if (error) {
      console.log(`❌ Supabase cache error: ${error.message}`)
      results.push({
        step: `supabase_cache_${propertyId}`,
        success: false,
        error: error.message,
        timing,
      })
    } else if (data) {
      console.log(`✅ Found in Supabase cache: ${data.title}`)
      results.push({
        step: `supabase_cache_${propertyId}`,
        success: true,
        data: {
          id: data.tokko_id,
          title: data.title,
          sync_status: data.sync_status,
          updated_at: data.updated_at,
        },
        timing,
      })
    } else {
      console.log(`❌ Not found in Supabase cache`)
      results.push({
        step: `supabase_cache_${propertyId}`,
        success: false,
        error: "Property not found in cache",
        timing,
      })
    }
  } catch (error: any) {
    console.log(`❌ Supabase cache exception: ${error.message}`)
    results.push({
      step: `supabase_cache_${propertyId}`,
      success: false,
      error: error.message,
      timing: Date.now() - startTime,
    })
  }
}

async function checkSupabaseView(propertyId: number, results: PropertyInvestigation[]) {
  const startTime = Date.now()
  try {
    console.log(`👁️ Checking properties_with_images view for ID ${propertyId}...`)

    const { data, error } = await supabase
      .from("properties_with_images")
      .select("*")
      .eq("tokko_id", propertyId)
      .single()

    const timing = Date.now() - startTime

    if (error) {
      console.log(`❌ View error: ${error.message}`)
      results.push({
        step: `supabase_view_${propertyId}`,
        success: false,
        error: error.message,
        timing,
      })
    } else if (data) {
      console.log(`✅ Found in view: ${data.title}`)
      results.push({
        step: `supabase_view_${propertyId}`,
        success: true,
        data: {
          id: data.tokko_id,
          title: data.title,
          images_count: data.images?.length || 0,
        },
        timing,
      })
    } else {
      console.log(`❌ Not found in view`)
      results.push({
        step: `supabase_view_${propertyId}`,
        success: false,
        error: "Property not found in view",
        timing,
      })
    }
  } catch (error: any) {
    console.log(`❌ View exception: ${error.message}`)
    results.push({
      step: `supabase_view_${propertyId}`,
      success: false,
      error: error.message,
      timing: Date.now() - startTime,
    })
  }
}

async function checkRedisCache(propertyId: number, results: PropertyInvestigation[]) {
  const startTime = Date.now()
  try {
    console.log(`🔴 Checking Redis cache for property:${propertyId}...`)

    // Check if Redis is configured
    const redisUrl = process.env.REDIS_URL || process.env.KV_REST_API_URL
    const redisHost = process.env.REDIS_HOST
    const redisPort = process.env.REDIS_PORT

    if (!redisUrl && !redisHost) {
      console.log(`ℹ️ Redis not configured - skipping Redis check`)
      results.push({
        step: `redis_cache_${propertyId}`,
        success: false,
        error: "Redis not configured",
        timing: Date.now() - startTime,
      })
      return
    }

    // Try to test Redis connection through hybrid cache service
    try {
      // This will test if Redis is working through the hybrid cache
      const testKey = `test:${Date.now()}`
      console.log(`   Testing Redis connectivity...`)

      results.push({
        step: `redis_cache_${propertyId}`,
        success: false,
        error: "Redis check requires actual cache service test",
        timing: Date.now() - startTime,
      })
    } catch (redisError: any) {
      console.log(`❌ Redis test error: ${redisError.message}`)
      results.push({
        step: `redis_cache_${propertyId}`,
        success: false,
        error: redisError.message,
        timing: Date.now() - startTime,
      })
    }
  } catch (error: any) {
    console.log(`❌ Redis exception: ${error.message}`)
    results.push({
      step: `redis_cache_${propertyId}`,
      success: false,
      error: error.message,
      timing: Date.now() - startTime,
    })
  }
}

async function checkHybridCacheService(propertyId: number, results: PropertyInvestigation[]) {
  const startTime = Date.now()
  try {
    console.log(`🔄 Testing hybrid cache service for ID ${propertyId}...`)

    const property = await hybridCacheService.getProperty(propertyId)
    const timing = Date.now() - startTime

    if (property) {
      console.log(`✅ Hybrid cache found: ${property.title}`)
      results.push({
        step: `hybrid_cache_${propertyId}`,
        success: true,
        data: {
          id: property.id,
          title: property.title,
          location: property.location.name,
          price: property.mainPrice,
        },
        timing,
      })
    } else {
      console.log(`❌ Hybrid cache returned null`)
      results.push({
        step: `hybrid_cache_${propertyId}`,
        success: false,
        error: "Hybrid cache returned null",
        timing,
      })
    }
  } catch (error: any) {
    console.log(`❌ Hybrid cache exception: ${error.message}`)
    results.push({
      step: `hybrid_cache_${propertyId}`,
      success: false,
      error: error.message,
      timing: Date.now() - startTime,
    })
  }
}

async function checkTokkoAPI(propertyId: number, results: PropertyInvestigation[]) {
  const startTime = Date.now()
  try {
    console.log(`🌐 Testing direct Tokko API for ID ${propertyId}...`)

    const tokkoProperty = await tokkoClient.getProperty(propertyId)
    const timing = Date.now() - startTime

    if (tokkoProperty) {
      console.log(`✅ Tokko API found: ${tokkoProperty.publication_title}`)
      results.push({
        step: `tokko_api_${propertyId}`,
        success: true,
        data: {
          id: tokkoProperty.id,
          title: tokkoProperty.publication_title,
          type: tokkoProperty.type?.name,
          location: tokkoProperty.location?.name,
        },
        timing,
      })
    } else {
      console.log(`❌ Tokko API returned null`)
      results.push({
        step: `tokko_api_${propertyId}`,
        success: false,
        error: "Tokko API returned null",
        timing,
      })
    }
  } catch (error: any) {
    console.log(`❌ Tokko API exception: ${error.message}`)
    results.push({
      step: `tokko_api_${propertyId}`,
      success: false,
      error: error.message,
      timing: Date.now() - startTime,
    })
  }
}

async function checkAPIEndpoint(propertyId: number, results: PropertyInvestigation[]) {
  const startTime = Date.now()
  try {
    console.log(`🔗 Testing API endpoint /api/properties/${propertyId}...`)

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

    const response = await fetch(`${baseUrl}/api/properties/${propertyId}`)
    const timing = Date.now() - startTime

    if (response.ok) {
      const data = await response.json()
      console.log(`✅ API endpoint success: ${data.success ? "Success" : "Failed"}`)
      results.push({
        step: `api_endpoint_${propertyId}`,
        success: data.success,
        data: data.success
          ? {
              id: data.property?.id,
              title: data.property?.title,
              cacheSource: data.meta?.cacheSource,
            }
          : null,
        error: data.success ? undefined : data.message,
        timing,
      })
    } else {
      console.log(`❌ API endpoint failed: ${response.status} ${response.statusText}`)
      const errorData = await response.json().catch(() => ({}))
      results.push({
        step: `api_endpoint_${propertyId}`,
        success: false,
        error: `HTTP ${response.status}: ${errorData.message || response.statusText}`,
        timing,
      })
    }
  } catch (error: any) {
    console.log(`❌ API endpoint exception: ${error.message}`)
    results.push({
      step: `api_endpoint_${propertyId}`,
      success: false,
      error: error.message,
      timing: Date.now() - startTime,
    })
  }
}

async function getSampleProperties(results: PropertyInvestigation[]) {
  try {
    console.log(`\n📊 Getting sample of existing properties...`)

    // Get total count
    const { count: totalCount } = await supabase
      .from("properties_cache")
      .select("tokko_id", { count: "exact", head: true })

    console.log(`📈 Total properties in cache: ${totalCount || 0}`)

    // Get sample properties
    const { data: sampleProperties, error } = await supabase
      .from("properties_cache")
      .select("tokko_id, title, sync_status, updated_at, featured")
      .order("updated_at", { ascending: false })
      .limit(10)

    if (error) {
      console.log(`❌ Error getting sample: ${error.message}`)
    } else if (sampleProperties && sampleProperties.length > 0) {
      console.log(`✅ Sample properties:`)
      sampleProperties.forEach((prop, index) => {
        console.log(
          `  ${index + 1}. ID: ${prop.tokko_id} | ${prop.title} | Status: ${prop.sync_status} | Featured: ${prop.featured}`,
        )
      })

      results.push({
        step: "sample_properties",
        success: true,
        data: {
          total: totalCount,
          sample: sampleProperties.map((p) => ({
            id: p.tokko_id,
            title: p.title,
            status: p.sync_status,
            featured: p.featured,
          })),
        },
      })
    } else {
      console.log(`❌ No properties found in cache`)
      results.push({
        step: "sample_properties",
        success: false,
        error: "No properties found in cache",
      })
    }
  } catch (error: any) {
    console.log(`❌ Sample properties exception: ${error.message}`)
    results.push({
      step: "sample_properties",
      success: false,
      error: error.message,
    })
  }
}

async function testPropertyPageRoute(results: PropertyInvestigation[]) {
  try {
    console.log(`\n🔗 Testing property page route structure...`)

    // Check if we have any properties to test with
    const sampleResult = results.find((r) => r.step === "sample_properties" && r.success)
    if (sampleResult && sampleResult.data?.sample?.length > 0) {
      const testId = sampleResult.data.sample[0].id
      console.log(`🧪 Testing with existing property ID: ${testId}`)

      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

      // Test the page route (this would normally be done in browser)
      console.log(`🔗 Would test: ${baseUrl}/propiedades/${testId}`)

      results.push({
        step: "page_route_test",
        success: true,
        data: {
          testUrl: `${baseUrl}/propiedades/${testId}`,
          propertyId: testId,
        },
      })
    } else {
      console.log(`❌ No sample properties available for route testing`)
      results.push({
        step: "page_route_test",
        success: false,
        error: "No sample properties available",
      })
    }
  } catch (error: any) {
    console.log(`❌ Route test exception: ${error.message}`)
    results.push({
      step: "page_route_test",
      success: false,
      error: error.message,
    })
  }
}

function analyzeResults(results: PropertyInvestigation[]) {
  console.log(`\n📋 ANALYSIS AND RECOMMENDATIONS`)
  console.log("=".repeat(60))

  const successfulSteps = results.filter((r) => r.success)
  const failedSteps = results.filter((r) => !r.success)

  console.log(`✅ Successful steps: ${successfulSteps.length}`)
  console.log(`❌ Failed steps: ${failedSteps.length}`)

  // Analyze data flow
  console.log(`\n🔍 DATA FLOW ANALYSIS:`)

  // Check if we have properties in cache
  const cacheResults = results.filter((r) => r.step.includes("supabase_cache"))
  const hasPropertiesInCache = cacheResults.some((r) => r.success)

  if (!hasPropertiesInCache) {
    console.log(`❌ ISSUE: No properties found in Supabase cache`)
    console.log(`   SOLUTION: Run property sync to populate cache`)
    console.log(
      `   COMMAND: curl -X POST http://localhost:3000/api/properties/sync -H "Content-Type: application/json" -d '{"mode": "full", "limit": 50}'`,
    )
  }

  // Check API connectivity
  const apiResults = results.filter((r) => r.step.includes("tokko_api"))
  const hasAPIAccess = apiResults.some((r) => r.success)

  if (!hasAPIAccess) {
    console.log(`❌ ISSUE: Tokko API not accessible or no valid property IDs`)
    console.log(`   SOLUTION: Check API credentials and test with known property IDs`)
  }

  // Check hybrid cache
  const hybridResults = results.filter((r) => r.step.includes("hybrid_cache"))
  const hybridWorking = hybridResults.some((r) => r.success)

  if (!hybridWorking) {
    console.log(`❌ ISSUE: Hybrid cache service not returning properties`)
    console.log(`   SOLUTION: Check cache service configuration and data flow`)
  }

  // Check API endpoint
  const endpointResults = results.filter((r) => r.step.includes("api_endpoint"))
  const endpointWorking = endpointResults.some((r) => r.success)

  if (!endpointWorking) {
    console.log(`❌ ISSUE: API endpoint /api/properties/[id] not working`)
    console.log(`   SOLUTION: Check route handler and error handling`)
  }

  // Performance analysis
  const timings = results.filter((r) => r.timing).map((r) => r.timing!)
  if (timings.length > 0) {
    const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length
    console.log(`\n⏱️ PERFORMANCE:`)
    console.log(`   Average response time: ${avgTiming.toFixed(2)}ms`)
    console.log(`   Fastest: ${Math.min(...timings)}ms`)
    console.log(`   Slowest: ${Math.max(...timings)}ms`)
  }

  // Specific recommendations
  console.log(`\n💡 SPECIFIC RECOMMENDATIONS:`)

  const sampleResult = results.find((r) => r.step === "sample_properties")
  if (sampleResult?.success && sampleResult.data?.total > 0) {
    console.log(`✅ Database has ${sampleResult.data.total} properties`)
    console.log(`   Try testing with these existing IDs:`)
    sampleResult.data.sample.forEach((prop: any, index: number) => {
      console.log(`   ${index + 1}. http://localhost:3000/propiedades/${prop.id}`)
    })
  } else {
    console.log(`❌ No properties in database - run sync first`)
  }

  // Error patterns
  const errorPatterns = failedSteps.reduce(
    (acc, step) => {
      const error = step.error || "Unknown error"
      acc[error] = (acc[error] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  if (Object.keys(errorPatterns).length > 0) {
    console.log(`\n🚨 COMMON ERROR PATTERNS:`)
    Object.entries(errorPatterns).forEach(([error, count]) => {
      console.log(`   ${count}x: ${error}`)
    })
  }

  console.log(`\n🔧 NEXT STEPS:`)
  console.log(`1. Run property sync if no properties in cache`)
  console.log(`2. Test with existing property IDs from sample`)
  console.log(`3. Check API endpoint with working property ID`)
  console.log(`4. Verify page routing with valid property`)
  console.log(`5. Check browser network tab for detailed errors`)

  console.log(`\n📝 ENVIRONMENT SUMMARY:`)
  console.log(`   Supabase URL: ${/* Supabase URL removed */}`)
  console.log(`   Redis configured: ${process.env.REDIS_URL || process.env.REDIS_HOST ? "Yes" : "No"}`)
  console.log(`   Base URL: ${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}`)
}

// Run the investigation
investigatePropertyNotFound().catch(console.error)