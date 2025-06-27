import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

async function testPropertyDetailAPI() {
  console.log("🧪 Testing property detail API...")

  try {
    // First, get a sample property ID from the database
    const { createClient } = await import("@supabase/supabase-js")

    const supabase = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: sampleProperties } = await supabase.from("properties_cache").select("tokko_id, title").limit(3)

    if (!sampleProperties || sampleProperties.length === 0) {
      console.log("❌ No properties found in database")
      return
    }

    console.log(`📋 Found ${sampleProperties.length} sample properties:`)
    sampleProperties.forEach((prop) => {
      console.log(`  - ${prop.tokko_id}: ${prop.title}`)
    })

    // Test the API endpoint
    const testId = sampleProperties[0].tokko_id
    console.log(`\n🔍 Testing API for property ${testId}...`)

    const response = await fetch(`http://localhost:3000/api/properties/${testId}`)

    if (!response.ok) {
      console.error(`❌ API returned ${response.status}: ${response.statusText}`)
      const errorText = await response.text()
      console.error("Error response:", errorText)
      return
    }

    const data = await response.json()

    if (data.success) {
      console.log("✅ API working correctly!")
      console.log(`Property: ${data.property.title}`)
      console.log(`Location: ${data.property.location.name}`)
      console.log(`Images: ${data.property.images.length} found`)
    } else {
      console.error("❌ API returned error:", data.error)
    }
  } catch (error) {
    console.error("❌ Test error:", error)
  }
}

testPropertyDetailAPI()
