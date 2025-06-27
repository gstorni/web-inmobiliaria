// Comprehensive TokkoBroker API Investigation Script with .env.local support
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

interface ApiInvestigation {
  endpoint: string
  method: string
  status: number
  success: boolean
  data?: any
  error?: string
  responseTime: number
  headers?: Record<string, string>
}

async function investigateEndpoint(endpoint: string, description: string): Promise<ApiInvestigation> {
  console.log(`\n🔍 Testing: ${description}`)
  console.log(`📡 Endpoint: ${endpoint}`)

  const startTime = Date.now()

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "IndustrialPro-Investigation/1.0",
      },
    })

    const responseTime = Date.now() - startTime
    const responseHeaders: Record<string, string> = {}

    // Capture important headers
    response.headers.forEach((value, key) => {
      if (["content-type", "x-ratelimit-remaining", "x-ratelimit-limit"].includes(key.toLowerCase())) {
        responseHeaders[key] = value
      }
    })

    let data: any = null
    let error: string | undefined = undefined

    try {
      const text = await response.text()
      if (text) {
        data = JSON.parse(text)
      }
    } catch (parseError) {
      error = `JSON Parse Error: ${parseError}`
    }

    const result: ApiInvestigation = {
      endpoint,
      method: "GET",
      status: response.status,
      success: response.ok,
      data,
      error: error || (!response.ok ? `HTTP ${response.status}: ${response.statusText}` : undefined),
      responseTime,
      headers: responseHeaders,
    }

    // Log results
    console.log(`✅ Status: ${response.status} ${response.statusText}`)
    console.log(`⏱️  Response Time: ${responseTime}ms`)

    if (response.ok && data) {
      if (data.objects) {
        console.log(`📊 Objects Found: ${data.objects.length}`)
        console.log(`📈 Total Count: ${data.meta?.total_count || "Unknown"}`)

        if (data.objects.length > 0) {
          const firstObject = data.objects[0]
          console.log(`🏠 First Property ID: ${firstObject.id}`)
          console.log(
            `🏷️  First Property Title: ${firstObject.publication_title || firstObject.type?.name || "No title"}`,
          )
        }
      } else if (data.id) {
        console.log(`🏠 Single Property ID: ${data.id}`)
        console.log(`🏷️  Property Title: ${data.publication_title || data.type?.name || "No title"}`)
      }
    } else {
      console.log(`❌ Error: ${error || "Unknown error"}`)
      if (data) {
        console.log(`📄 Error Data:`, JSON.stringify(data, null, 2))
      }
    }

    return result
  } catch (fetchError) {
    const responseTime = Date.now() - startTime
    console.log(`❌ Network Error: ${fetchError}`)

    return {
      endpoint,
      method: "GET",
      status: 0,
      success: false,
      error: `Network Error: ${fetchError}`,
      responseTime,
    }
  }
}

async function investigateTokkoAPI() {
  console.log("🔬 TOKKO BROKER API INVESTIGATION")
  console.log("=".repeat(60))

  // Check for API key
  if (!TOKKO_API_KEY) {
    console.log("❌ TOKKO_API_KEY not found in environment variables")
    console.log("💡 Solutions:")
    console.log("   1. Check your .env.local file exists in the project root")
    console.log("   2. Ensure it contains: TOKKO_API_KEY=your_api_key_here")
    console.log("   3. Or run: TOKKO_API_KEY=your_key npx tsx scripts/investigate-tokko-api.ts")
    console.log("   4. Or use the web dashboard at: http://localhost:3000/investigate-tokko")
    return
  }

  console.log(`🔑 API Key: ${TOKKO_API_KEY.substring(0, 8)}...${TOKKO_API_KEY.substring(TOKKO_API_KEY.length - 4)}`)

  const investigations: ApiInvestigation[] = []

  // 1. Test basic properties endpoint
  investigations.push(
    await investigateEndpoint(
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json`,
      "Basic Properties List (No Limit)",
    ),
  )

  // 2. Test with different limits
  investigations.push(
    await investigateEndpoint(
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&limit=1`,
      "Properties List (Limit 1)",
    ),
  )

  investigations.push(
    await investigateEndpoint(
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&limit=10`,
      "Properties List (Limit 10)",
    ),
  )

  investigations.push(
    await investigateEndpoint(
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&limit=50`,
      "Properties List (Limit 50)",
    ),
  )

  // 3. Test pagination
  investigations.push(
    await investigateEndpoint(
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&limit=10&offset=10`,
      "Properties List (Limit 10, Offset 10)",
    ),
  )

  // 4. Get some real property IDs first
  const propertiesResponse = investigations.find((inv) => inv.success && inv.data?.objects?.length > 0)
  let realPropertyIds: number[] = []

  if (propertiesResponse?.data?.objects) {
    realPropertyIds = propertiesResponse.data.objects.slice(0, 5).map((prop: any) => prop.id)
    console.log(`\n📋 Found Real Property IDs: ${realPropertyIds.join(", ")}`)
  }

  // 5. Test individual property endpoints with real IDs
  for (const propertyId of realPropertyIds) {
    investigations.push(
      await investigateEndpoint(
        `${TOKKO_API_URL}/property/${propertyId}/?key=${TOKKO_API_KEY}&format=json`,
        `Individual Property (ID: ${propertyId})`,
      ),
    )
  }

  // 6. Test with non-existent IDs
  const fakeIds = [1, 2, 3, 999999]
  for (const fakeId of fakeIds) {
    investigations.push(
      await investigateEndpoint(
        `${TOKKO_API_URL}/property/${fakeId}/?key=${TOKKO_API_KEY}&format=json`,
        `Non-existent Property (ID: ${fakeId})`,
      ),
    )
  }

  // 7. Test property types
  investigations.push(
    await investigateEndpoint(`${TOKKO_API_URL}/property_type/?key=${TOKKO_API_KEY}&format=json`, "Property Types"),
  )

  // 8. Test locations
  investigations.push(
    await investigateEndpoint(`${TOKKO_API_URL}/location/?key=${TOKKO_API_KEY}&format=json`, "Locations"),
  )

  // 9. Test with filters
  investigations.push(
    await investigateEndpoint(
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&operation_type=Venta`,
      "Properties (Operation: Venta)",
    ),
  )

  investigations.push(
    await investigateEndpoint(
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&operation_type=Alquiler`,
      "Properties (Operation: Alquiler)",
    ),
  )

  // Generate comprehensive report
  console.log("\n" + "=".repeat(60))
  console.log("📊 INVESTIGATION SUMMARY")
  console.log("=".repeat(60))

  const successfulRequests = investigations.filter((inv) => inv.success)
  const failedRequests = investigations.filter((inv) => !inv.success)

  console.log(`✅ Successful Requests: ${successfulRequests.length}`)
  console.log(`❌ Failed Requests: ${failedRequests.length}`)
  console.log(
    `⏱️  Average Response Time: ${Math.round(investigations.reduce((sum, inv) => sum + inv.responseTime, 0) / investigations.length)}ms`,
  )

  // Analyze property listing behavior
  const propertyListings = investigations.filter(
    (inv) => inv.endpoint.includes("/property/?") && inv.success && inv.data?.objects,
  )

  if (propertyListings.length > 0) {
    console.log("\n🏠 PROPERTY LISTINGS ANALYSIS:")
    propertyListings.forEach((inv) => {
      const url = new URL(inv.endpoint)
      const limit = url.searchParams.get("limit") || "default"
      const offset = url.searchParams.get("offset") || "0"
      console.log(
        `   Limit: ${limit}, Offset: ${offset} → ${inv.data.objects.length} properties returned (Total: ${inv.data.meta?.total_count})`,
      )
    })
  }

  // Analyze individual property requests
  const individualProperties = investigations.filter(
    (inv) => inv.endpoint.includes("/property/") && !inv.endpoint.includes("/property/?"),
  )

  console.log("\n🔍 INDIVIDUAL PROPERTY ANALYSIS:")
  const successfulIndividual = individualProperties.filter((inv) => inv.success)
  const failedIndividual = individualProperties.filter((inv) => !inv.success)

  console.log(`   ✅ Successful: ${successfulIndividual.length}`)
  console.log(`   ❌ Failed (404): ${failedIndividual.length}`)

  if (successfulIndividual.length > 0) {
    console.log("   ✅ Working Property IDs:")
    successfulIndividual.forEach((inv) => {
      const id = inv.endpoint.match(/\/property\/(\d+)\//)?.[1]
      console.log(`      - ID ${id}: ${inv.data?.publication_title || inv.data?.type?.name || "No title"}`)
    })
  }

  if (failedIndividual.length > 0) {
    console.log("   ❌ Non-existent Property IDs:")
    failedIndividual.forEach((inv) => {
      const id = inv.endpoint.match(/\/property\/(\d+)\//)?.[1]
      console.log(`      - ID ${id}: ${inv.error}`)
    })
  }

  // Key findings
  console.log("\n🎯 KEY FINDINGS:")

  const defaultLimitResponse = investigations.find(
    (inv) => inv.endpoint.includes("/property/?") && !inv.endpoint.includes("limit=") && inv.success,
  )

  if (defaultLimitResponse?.data?.objects) {
    console.log(`   📊 Default limit returns: ${defaultLimitResponse.data.objects.length} properties`)
    console.log(`   📈 Total available: ${defaultLimitResponse.data.meta?.total_count || "Unknown"}`)
  }

  if (realPropertyIds.length > 0) {
    console.log(`   🔢 Real property IDs start from: ${Math.min(...realPropertyIds)}`)
    console.log(`   🔢 Real property IDs go up to: ${Math.max(...realPropertyIds)}`)
  }

  console.log("\n💡 RECOMMENDATIONS:")
  console.log("   1. Always use real property IDs from the /property/ endpoint")
  console.log("   2. IDs 1, 2, 3 don't exist - they're not sequential from 1")
  console.log("   3. Use limit parameter to control how many properties are returned")
  console.log("   4. Check total_count in meta to see how many properties are available")
  console.log("   5. Use offset for pagination")

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalRequests: investigations.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      averageResponseTime: Math.round(
        investigations.reduce((sum, inv) => sum + inv.responseTime, 0) / investigations.length,
      ),
    },
    realPropertyIds,
    investigations,
  }
}

// Run the investigation
investigateTokkoAPI().catch(console.error)
