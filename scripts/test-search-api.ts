import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

async function testSearchAPI() {
  console.log("🧪 Search API Test Tool")
  console.log("=".repeat(40))

  const baseUrl = "http://localhost:3000"

  const testCases = [
    {
      name: "Basic search (no filters)",
      url: "/api/properties/search?limit=5",
    },
    {
      name: "Type filter (Industrial)",
      url: "/api/properties/search?type=12&limit=5",
    },
    {
      name: "Operation filter (Venta)",
      url: "/api/properties/search?operation=Venta&limit=5",
    },
    {
      name: "Text search",
      url: "/api/properties/search?q=industrial&limit=5",
    },
    {
      name: "Price range",
      url: "/api/properties/search?minPrice=100000&maxPrice=500000&limit=5",
    },
    {
      name: "Surface range",
      url: "/api/properties/search?minSurface=100&maxSurface=1000&limit=5",
    },
    {
      name: "Combined filters",
      url: "/api/properties/search?type=12&operation=Venta&limit=5",
    },
  ]

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`)
    console.log(`📡 URL: ${testCase.url}`)

    try {
      const startTime = Date.now()
      const response = await fetch(`${baseUrl}${testCase.url}`)
      const responseTime = Date.now() - startTime

      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`)
        const errorText = await response.text()
        console.log("Error details:", errorText.substring(0, 200))
        continue
      }

      const data = await response.json()

      console.log(`✅ Success (${responseTime}ms)`)
      console.log(`📊 Properties: ${data.properties?.length || 0}`)
      console.log(`📊 Total: ${data.total || 0}`)
      console.log(`📊 Cache source: ${data.meta?.cacheSource || data.source || "unknown"}`)
      console.log(`📊 Response time: ${data.meta?.responseTime || responseTime}ms`)

      if (data.properties && data.properties.length > 0) {
        const sample = data.properties[0]
        console.log(`📦 Sample: ${sample.title} (${sample.type})`)
      }

      if (data.error) {
        console.log(`⚠️ API Error: ${data.message || data.error}`)
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`)
    }
  }

  console.log("\n🔧 Next Steps:")
  console.log("1. If all tests fail: Check if Next.js dev server is running")
  console.log("2. If 0 properties: Run cache warming script")
  console.log("3. If cache source 'unknown': Check hybrid cache service")
  console.log("4. If specific filters fail: Check database schema")
}

// Check if Next.js server is running first
async function checkServer() {
  try {
    const response = await fetch("http://localhost:3000/api/properties/search?limit=1")
    return response.ok
  } catch (error) {
    return false
  }
}

async function main() {
  const serverRunning = await checkServer()

  if (!serverRunning) {
    console.log("❌ Next.js dev server not running!")
    console.log("🔧 Please start it with: npm run dev")
    console.log("Then run this script again.")
    return
  }

  await testSearchAPI()
}

main().catch(console.error)
