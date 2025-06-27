import { config } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

async function diagnosePropertyTypes() {
  console.log("🔍 Diagnosing property types in database...")

  try {
    // Create Supabase client
    const supabase = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get all unique property types
    const { data: propertyTypes, error } = await supabase
      .from("properties_cache")
      .select("property_type, property_type_code")
      .not("property_type_code", "is", null)

    if (error) {
      console.error("❌ Database error:", error)
      return
    }

    // Group by property type code
    const typeMap = new Map()
    propertyTypes?.forEach((prop) => {
      const key = prop.property_type_code
      if (!typeMap.has(key)) {
        typeMap.set(key, {
          code: key,
          name: prop.property_type,
          count: 0,
        })
      }
      typeMap.get(key).count++
    })

    console.log("\n📊 Property types found in database:")
    console.log("=".repeat(60))

    Array.from(typeMap.values())
      .sort((a, b) => b.count - a.count)
      .forEach((type) => {
        console.log(`Code: ${type.code.toString().padEnd(3)} | Name: ${type.name.padEnd(25)} | Count: ${type.count}`)
      })

    console.log("\n🔧 Filter options in your form:")
    console.log("=".repeat(60))
    const filterOptions = [
      { value: "12", name: "Nave Industrial" },
      { value: "24", name: "Galpón" },
      { value: "14", name: "Depósito" },
      { value: "27", name: "Terreno Industrial" },
      { value: "5", name: "Oficina" },
      { value: "7", name: "Local Comercial" },
    ]

    filterOptions.forEach((option) => {
      const found = typeMap.has(option.value)
      const status = found ? "✅ FOUND" : "❌ NOT FOUND"
      const count = found ? `(${typeMap.get(option.value).count} properties)` : ""
      console.log(`${option.value.padEnd(3)} | ${option.name.padEnd(25)} | ${status} ${count}`)
    })

    // Test a specific filter
    console.log("\n🧪 Testing filter for property type '12':")
    const { data: testData, error: testError } = await supabase
      .from("properties_cache")
      .select("tokko_id, title, property_type, property_type_code")
      .eq("property_type_code", "12")
      .limit(5)

    if (testError) {
      console.error("❌ Test query error:", testError)
    } else {
      console.log(`Found ${testData?.length || 0} properties with type code '12':`)
      testData?.forEach((prop) => {
        console.log(`  - ${prop.tokko_id}: ${prop.title} (${prop.property_type})`)
      })
    }
  } catch (error) {
    console.error("❌ Script error:", error)
  }
}

diagnosePropertyTypes()
