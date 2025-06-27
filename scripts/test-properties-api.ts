import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function testPropertiesAPI() {
  console.log("🧪 Testing properties API endpoints...")

  const baseUrl = "http://localhost:3000"

  try {
    // Test the search API
    console.log("\n🔍 Testing /api/properties/search...")
    const searchResponse = await fetch(`${baseUrl}/api/properties/search?limit=5`)

    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      console.log("✅ Search API working:")
      console.log(`   - Total properties: ${searchData.total || 0}`)
      console.log(`   - Properties returned: ${searchData.properties?.length || 0}`)
      console.log(`   - Source: ${searchData.source || "unknown"}`)

      if (searchData.properties?.length > 0) {
        const firstProperty = searchData.properties[0]
        console.log(`   - First property: ${firstProperty.title}`)
        console.log(`   - Images: ${firstProperty.images?.length || 0}`)
      }
    } else {
      console.log(`❌ Search API failed: ${searchResponse.status} ${searchResponse.statusText}`)
      const errorText = await searchResponse.text()
      console.log(`   Error: ${errorText}`)
    }

    // Test direct database query
    console.log("\n💾 Testing direct database query...")
    const { createClient } = await import("@supabase/supabase-js")

    const supabase = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!)

    const { data, error, count } = await supabase
      .from("properties_cache")
      .select("tokko_id, title, images", { count: "exact" })
      .limit(3)

    if (error) {
      console.log("❌ Direct database query failed:", error.message)
    } else {
      console.log("✅ Direct database query working:")
      console.log(`   - Total properties in DB: ${count || 0}`)
      console.log(`   - Sample properties:`)
      data?.forEach((prop, index) => {
        console.log(`     ${index + 1}. ${prop.title} (${prop.images?.length || 0} images)`)
      })
    }
  } catch (error: any) {
    console.log("❌ Error testing APIs:", error.message)
  }
}

testPropertiesAPI()
