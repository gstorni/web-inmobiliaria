// Test script to verify TokkoBroker API integration
import { secureTokkoClient } from "@/lib/enhanced-tokko-client"

async function testTokkoAPI() {
  console.log("🔍 Testing TokkoBroker API Integration...")
  console.log("=".repeat(50))

  // Test 1: Check API Key
  console.log("\n1. 📋 API Key Configuration:")
  const apiKey = process.env.TOKKO_API_KEY
  if (!apiKey) {
    console.log("❌ TOKKO_API_KEY not found in environment variables")
    console.log("💡 Add your API key to .env.local:")
    console.log("   TOKKO_API_KEY=your_api_key_here")
    return
  }
  console.log(`✅ API Key found: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`)

  // Test 2: Basic API Connection
  console.log("\n2. 🌐 Testing API Connection:")
  try {
    const response = await fetch(`https://www.tokkobroker.com/api/v1/property/?key=${apiKey}&limit=1&format=json`)
    console.log(`✅ API Response Status: ${response.status}`)

    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.log(`Error details: ${errorText}`)
      return
    }

    const data = await response.json()
    console.log(`✅ API Response received with ${data.objects?.length || 0} properties`)
  } catch (error) {
    console.log(`❌ Connection Error: ${error}`)
    return
  }

  // Test 3: Secure Client
  console.log("\n3. 🔒 Testing Secure Client:")
  try {
    const properties = await secureTokkoClient.getProperties({ limit: "5" })
    console.log(`✅ Secure client works: ${properties.objects?.length || 0} properties fetched`)

    if (properties.objects && properties.objects.length > 0) {
      const firstProperty = properties.objects[0]
      console.log(`   Sample property: ${firstProperty.publication_title || firstProperty.type?.name}`)
      console.log(`   Price: ${firstProperty.currency} ${firstProperty.price}`)
      console.log(`   Location: ${firstProperty.location?.name}`)
    }
  } catch (error) {
    console.log(`❌ Secure client error: ${error}`)
  }

  // Test 4: Property Types
  console.log("\n4. 🏭 Testing Property Types:")
  try {
    const types = await secureTokkoClient.getPropertyTypes()
    console.log(`✅ Property types fetched: ${types.objects?.length || 0} types`)

    if (types.objects && types.objects.length > 0) {
      console.log("   Available types:")
      types.objects.slice(0, 5).forEach((type) => {
        console.log(`   - ${type.name}`)
      })
    }
  } catch (error) {
    console.log(`❌ Property types error: ${error}`)
  }

  // Test 5: Locations
  console.log("\n5. 📍 Testing Locations:")
  try {
    const locations = await secureTokkoClient.getLocations()
    console.log(`✅ Locations fetched: ${locations.objects?.length || 0} locations`)

    if (locations.objects && locations.objects.length > 0) {
      console.log("   Sample locations:")
      locations.objects.slice(0, 5).forEach((location) => {
        console.log(`   - ${location.name}${location.parent ? ` (${location.parent.name})` : ""}`)
      })
    }
  } catch (error) {
    console.log(`❌ Locations error: ${error}`)
  }

  // Test 6: Security Features
  console.log("\n6. 🛡️ Testing Security Features:")
  try {
    await secureTokkoClient.createProperty()
  } catch (error) {
    console.log(`✅ Security working: ${error}`)
  }

  console.log("\n" + "=".repeat(50))
  console.log("🎉 TokkoBroker API Test Complete!")
}

// Run the test
testTokkoAPI().catch(console.error)
