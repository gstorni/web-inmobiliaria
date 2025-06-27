// Test script to verify TokkoBroker schema compliance
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

// Official TokkoBroker fields from documentation
const OFFICIAL_FIELDS = [
  "publication_title",
  "reference_code",
  "web_price",
  "address",
  "room_amount",
  "bathroom_amount",
  "surface",
  "geo_lat",
  "geo_long",
  "description",
  "construction_date",
  "location",
  "photo",
]

async function testTokkoSchema() {
  console.log("🔍 TESTING TOKKO BROKER SCHEMA COMPLIANCE")
  console.log("=".repeat(50))

  if (!TOKKO_API_KEY) {
    console.log("❌ TOKKO_API_KEY not found")
    return
  }

  try {
    // Get a few properties to analyze their schema
    const response = await fetch(`${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&limit=3&format=json`)

    if (!response.ok) {
      console.log(`❌ API Error: ${response.status}`)
      return
    }

    const data = await response.json()

    if (!data.objects || data.objects.length === 0) {
      console.log("❌ No properties found")
      return
    }

    console.log(`✅ Found ${data.objects.length} properties to analyze`)

    // Analyze the first property
    const property = data.objects[0]
    console.log(`\n📋 Analyzing Property ID: ${property.id}`)
    console.log(`📝 Title: ${property.publication_title || "No title"}`)

    // Check which official fields are present
    console.log("\n🔍 OFFICIAL FIELD ANALYSIS:")
    OFFICIAL_FIELDS.forEach((field) => {
      const value = property[field]
      const status = value !== undefined && value !== null ? "✅" : "❌"
      const displayValue =
        value !== undefined && value !== null
          ? typeof value === "object"
            ? JSON.stringify(value)
            : value
          : "Not present"

      console.log(`   ${status} ${field}: ${displayValue}`)
    })

    // Show all available fields
    console.log("\n📊 ALL AVAILABLE FIELDS:")
    Object.keys(property)
      .sort()
      .forEach((field) => {
        const value = property[field]
        const type = Array.isArray(value) ? "array" : typeof value
        const isOfficial = OFFICIAL_FIELDS.includes(field) ? "📋" : "🔧"

        console.log(`   ${isOfficial} ${field} (${type})`)
      })

    // Test specific field values
    console.log("\n💰 PRICING ANALYSIS:")
    console.log(`   web_price: ${property.web_price || "Not set"}`)
    console.log(`   price: ${property.price || "Not set"}`)
    console.log(`   currency: ${property.currency || "Not set"}`)

    console.log("\n📐 SURFACE ANALYSIS:")
    console.log(`   surface (metros lote): ${property.surface || "Not set"}`)
    console.log(`   roofed_surface (metros construidos): ${property.roofed_surface || "Not set"}`)

    console.log("\n🏠 ROOM ANALYSIS:")
    console.log(`   room_amount (ambientes): ${property.room_amount || "Not set"}`)
    console.log(`   bathroom_amount (baños): ${property.bathroom_amount || "Not set"}`)

    console.log("\n📍 LOCATION ANALYSIS:")
    console.log(`   address: ${property.address || "Not set"}`)
    console.log(`   geo_lat: ${property.geo_lat || "Not set"}`)
    console.log(`   geo_long: ${property.geo_long || "Not set"}`)
    console.log(`   location: ${property.location ? JSON.stringify(property.location) : "Not set"}`)

    console.log("\n📸 MEDIA ANALYSIS:")
    console.log(`   photo: ${property.photo || "Not set"}`)
    console.log(`   photos: ${property.photos ? `${property.photos.length} photos` : "Not set"}`)

    // Check available operations
    if (property.available_operations) {
      console.log(`\n💼 AVAILABLE OPERATIONS: ${property.available_operations.join(", ")}`)
    }

    console.log("\n" + "=".repeat(50))
    console.log("✅ Schema analysis complete!")
  } catch (error) {
    console.error("❌ Error:", error)
  }
}

testTokkoSchema()
