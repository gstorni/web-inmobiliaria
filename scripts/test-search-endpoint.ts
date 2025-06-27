// Test script to verify TokkoBroker Search API endpoint
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

async function testSearchEndpoint() {
  console.log("🔍 TESTING TOKKO BROKER SEARCH ENDPOINT")
  console.log("=".repeat(50))

  if (!TOKKO_API_KEY) {
    console.log("❌ TOKKO_API_KEY not found in environment variables")
    return
  }

  console.log(`🔑 API Key: ${TOKKO_API_KEY.substring(0, 8)}...${TOKKO_API_KEY.substring(TOKKO_API_KEY.length - 4)}`)

  // Test 1: Basic search with no filters
  console.log("\n1. 📋 Testing basic search (no filters)")
  await testSearch("Basic Search", {
    key: TOKKO_API_KEY,
    limit: 5,
    offset: 0,
    search_data: {
      currency: "USD",
    },
  })

  // Test 2: Search with property type filter (Office = 5)
  console.log("\n2. 🏢 Testing property type filter (Office = 5)")
  await testSearch("Property Type Filter", {
    key: TOKKO_API_KEY,
    limit: 5,
    offset: 0,
    search_data: {
      currency: "USD",
      property_types: [5], // Office
    },
  })

  // Test 3: Search with operation type filter (Sale = 1)
  console.log("\n3. 💼 Testing operation type filter (Sale = 1)")
  await testSearch("Operation Type Filter", {
    key: TOKKO_API_KEY,
    limit: 5,
    offset: 0,
    search_data: {
      currency: "USD",
      operation_types: [1], // Sale
    },
  })

  // Test 4: Search with price range
  console.log("\n4. 💰 Testing price range filter")
  await testSearch("Price Range Filter", {
    key: TOKKO_API_KEY,
    limit: 5,
    offset: 0,
    search_data: {
      currency: "USD",
      price_from: 100000,
      price_to: 500000,
    },
  })

  // Test 5: Search with multiple filters
  console.log("\n5. 🔍 Testing multiple filters")
  await testSearch("Multiple Filters", {
    key: TOKKO_API_KEY,
    limit: 5,
    offset: 0,
    search_data: {
      currency: "USD",
      property_types: [5], // Office
      operation_types: [1], // Sale
      price_from: 50000,
    },
  })

  // Test 6: Search with tags
  console.log("\n6. 🏷️ Testing with tags filter")
  await testSearch("Tags Filter", {
    key: TOKKO_API_KEY,
    limit: 5,
    offset: 0,
    search_data: {
      currency: "USD",
      with_tags: [1299, 1493], // Industrial tags
    },
  })

  console.log("\n" + "=".repeat(50))
  console.log("🎉 Search endpoint testing complete!")
}

async function testSearch(testName: string, requestBody: any) {
  const startTime = Date.now()

  try {
    console.log(`\n🔍 ${testName}:`)
    console.log(`📡 Request body:`, JSON.stringify(requestBody, null, 2))

    const response = await fetch(`${TOKKO_API_URL}/property/search`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "IndustrialPro-Test/1.0",
      },
      body: JSON.stringify(requestBody),
    })

    const responseTime = Date.now() - startTime
    console.log(`📡 Response: ${response.status} ${response.statusText} (${responseTime}ms)`)

    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Success: ${data.objects?.length || 0} properties found`)
      console.log(`📊 Total available: ${data.meta?.total_count || 0}`)

      if (data.objects && data.objects.length > 0) {
        const firstProperty = data.objects[0]
        console.log(`🏠 First property: ${firstProperty.publication_title || firstProperty.type?.name || "No title"}`)
        console.log(`💰 Price: ${firstProperty.currency || "USD"} ${firstProperty.price || "N/A"}`)
        console.log(`📍 Location: ${firstProperty.location?.name || "N/A"}`)
      }
    } else {
      const errorText = await response.text()
      console.log(`❌ Error: ${response.status} ${response.statusText}`)
      console.log(`❌ Details: ${errorText}`)
    }
  } catch (error) {
    console.log(`❌ Network Error: ${error}`)
  }
}

// Run the test
testSearchEndpoint().catch(console.error)
