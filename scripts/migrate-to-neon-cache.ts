#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables first
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔄 ROBUST SUPABASE TO NEON MIGRATION")
console.log("=".repeat(50))

async function migrateSupabaseToNeonRobust() {
  try {
    // Step 1: Update schema
    console.log("\n📋 Step 1: Updating Neon schema...")
    await updateNeonSchema()

    // Step 2: Migrate properties with data cleaning
    console.log("\n📋 Step 2: Migrating properties with data cleaning...")
    await migratePropertiesRobust()

    // Step 3: Verify migration
    console.log("\n📋 Step 3: Verifying migration...")
    await verifyMigration()

    console.log("\n✅ ROBUST MIGRATION COMPLETED!")
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:", error)
    process.exit(1)
  }
}

async function updateNeonSchema() {
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    // Drop and recreate the table with proper types
    console.log("Recreating properties_cache table with proper schema...")

    await sql`DROP TABLE IF EXISTS properties_cache CASCADE`

    await sql`
      CREATE TABLE properties_cache (
        id SERIAL PRIMARY KEY,
        tokko_id INTEGER UNIQUE NOT NULL,
        title TEXT,
        description TEXT,
        rich_description TEXT,
        reference_code TEXT,
        
        -- Price handling - store as TEXT to avoid casting issues
        main_price TEXT,
        prices JSONB,
        available_operations TEXT[],
        
        -- Surface fields as DECIMAL
        surface DECIMAL(12,2),
        covered_surface DECIMAL(12,2),
        uncovered_surface DECIMAL(12,2),
        total_surface DECIMAL(12,2),
        
        -- Location fields
        location_name TEXT,
        location_full TEXT,
        location_short TEXT,
        address TEXT,
        real_address TEXT,
        coordinates JSONB,
        
        -- Property details
        property_type TEXT,
        property_type_code TEXT,
        operation_type TEXT,
        age INTEGER,
        condition TEXT,
        situation TEXT,
        zonification TEXT,
        
        -- Room details
        rooms INTEGER DEFAULT 0,
        bathrooms INTEGER DEFAULT 0,
        toilets INTEGER DEFAULT 0,
        suites INTEGER DEFAULT 0,
        parking_spaces INTEGER DEFAULT 0,
        floors INTEGER DEFAULT 0,
        orientation TEXT,
        
        -- Additional data
        amenities TEXT[],
        tags TEXT[],
        extra_attributes JSONB,
        contact_info JSONB,
        
        -- Status and flags
        featured BOOLEAN DEFAULT false,
        status INTEGER DEFAULT 0,
        transaction_requirements TEXT,
        has_temporary_rent BOOLEAN DEFAULT false,
        expenses DECIMAL(12,2),
        public_url TEXT,
        
        -- Timestamps
        tokko_created_at TIMESTAMP WITH TIME ZONE,
        tokko_updated_at TIMESTAMP WITH TIME ZONE,
        cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        sync_status TEXT DEFAULT 'pending',
        
        -- Raw data for debugging
        raw_data JSONB,
        
        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    // Create indexes
    console.log("Creating performance indexes...")
    await sql`CREATE INDEX idx_properties_cache_tokko_id ON properties_cache(tokko_id)`
    await sql`CREATE INDEX idx_properties_cache_property_type ON properties_cache(property_type_code)`
    await sql`CREATE INDEX idx_properties_cache_operation_type ON properties_cache(operation_type)`
    await sql`CREATE INDEX idx_properties_cache_location ON properties_cache(location_name)`
    await sql`CREATE INDEX idx_properties_cache_featured ON properties_cache(featured)`
    await sql`CREATE INDEX idx_properties_cache_sync_status ON properties_cache(sync_status)`
    await sql`CREATE INDEX idx_properties_cache_surface ON properties_cache(surface) WHERE surface IS NOT NULL`

    console.log("✅ Schema updated successfully")
  } catch (error) {
    console.error("❌ Failed to update schema:", error)
    throw error
  }
}

async function migratePropertiesRobust() {
  try {
    const supabaseUrl = null
    const supabaseKey = null

    if (!supabaseUrl || !supabaseKey) {
      console.log("ℹ️ No Supabase configuration found, skipping migration")
      return
    }

    const { createClient } = await import("@supabase/supabase-js")
    const { neon } = await import("@neondatabase/serverless")

    const supabase = createClient(supabaseUrl, supabaseKey)
    const sql = neon(process.env.DATABASE_URL!)

    let offset = 0
    const batchSize = 50 // Smaller batches for better error handling
    let totalMigrated = 0
    let totalErrors = 0

    while (true) {
      const { data: properties, error } = await supabase
        .from("properties_cache")
        .select("*")
        .range(offset, offset + batchSize - 1)

      if (error) {
        console.error("Error fetching properties:", error)
        break
      }

      if (!properties || properties.length === 0) {
        break
      }

      console.log(`Processing batch ${Math.floor(offset / batchSize) + 1}: ${properties.length} properties...`)

      for (const property of properties) {
        try {
          // Clean and convert data
          const cleanedProperty = cleanPropertyData(property)

          await sql`
            INSERT INTO properties_cache (
              tokko_id, title, description, rich_description, reference_code,
              main_price, prices, available_operations,
              surface, covered_surface, uncovered_surface, total_surface,
              location_name, location_full, location_short, address, real_address,
              coordinates, property_type, property_type_code, operation_type,
              age, condition, situation, zonification,
              rooms, bathrooms, toilets, suites, parking_spaces, floors, orientation,
              amenities, tags, extra_attributes, contact_info,
              featured, status, transaction_requirements, has_temporary_rent,
              expenses, public_url, tokko_created_at, tokko_updated_at,
              raw_data, sync_status
            ) VALUES (
              ${cleanedProperty.tokko_id},
              ${cleanedProperty.title},
              ${cleanedProperty.description},
              ${cleanedProperty.rich_description},
              ${cleanedProperty.reference_code},
              ${cleanedProperty.main_price},
              ${cleanedProperty.prices},
              ${cleanedProperty.available_operations},
              ${cleanedProperty.surface},
              ${cleanedProperty.covered_surface},
              ${cleanedProperty.uncovered_surface},
              ${cleanedProperty.total_surface},
              ${cleanedProperty.location_name},
              ${cleanedProperty.location_full},
              ${cleanedProperty.location_short},
              ${cleanedProperty.address},
              ${cleanedProperty.real_address},
              ${cleanedProperty.coordinates},
              ${cleanedProperty.property_type},
              ${cleanedProperty.property_type_code},
              ${cleanedProperty.operation_type},
              ${cleanedProperty.age},
              ${cleanedProperty.condition},
              ${cleanedProperty.situation},
              ${cleanedProperty.zonification},
              ${cleanedProperty.rooms},
              ${cleanedProperty.bathrooms},
              ${cleanedProperty.toilets},
              ${cleanedProperty.suites},
              ${cleanedProperty.parking_spaces},
              ${cleanedProperty.floors},
              ${cleanedProperty.orientation},
              ${cleanedProperty.amenities},
              ${cleanedProperty.tags},
              ${cleanedProperty.extra_attributes},
              ${cleanedProperty.contact_info},
              ${cleanedProperty.featured},
              ${cleanedProperty.status},
              ${cleanedProperty.transaction_requirements},
              ${cleanedProperty.has_temporary_rent},
              ${cleanedProperty.expenses},
              ${cleanedProperty.public_url},
              ${cleanedProperty.tokko_created_at},
              ${cleanedProperty.tokko_updated_at},
              ${cleanedProperty.raw_data},
              'migrated'
            )
          `

          totalMigrated++
        } catch (err) {
          console.warn(`❌ Failed to migrate property ${property.tokko_id}: ${err.message}`)
          totalErrors++

          // Log problematic data for debugging
          if (totalErrors <= 5) {
            console.log("   Problematic data sample:", {
              tokko_id: property.tokko_id,
              main_price: property.main_price,
              surface: property.surface,
              title: property.title?.substring(0, 50),
            })
          }
        }
      }

      offset += batchSize
      console.log(`   Progress: Migrated ${totalMigrated}, Errors: ${totalErrors}`)
    }

    console.log(`\n✅ Migration completed:`)
    console.log(`   - Successfully migrated: ${totalMigrated}`)
    console.log(`   - Errors: ${totalErrors}`)
    console.log(`   - Success rate: ${((totalMigrated / (totalMigrated + totalErrors)) * 100).toFixed(1)}%`)
  } catch (error) {
    console.error("❌ Property migration failed:", error)
    throw error
  }
}

function cleanPropertyData(property: any) {
  return {
    tokko_id: property.tokko_id,
    title: property.title || null,
    description: property.description || null,
    rich_description: property.rich_description || null,
    reference_code: property.reference_code || null,

    // Clean price data - convert JSONB to string if needed
    main_price: cleanPriceField(property.main_price),
    prices: cleanJsonField(property.prices),
    available_operations: cleanArrayField(property.available_operations),

    // Clean numeric fields
    surface: cleanNumericField(property.surface),
    covered_surface: cleanNumericField(property.covered_surface),
    uncovered_surface: cleanNumericField(property.uncovered_surface),
    total_surface: cleanNumericField(property.total_surface),

    // Location fields
    location_name: property.location_name || null,
    location_full: property.location_full || null,
    location_short: property.location_short || null,
    address: property.address || null,
    real_address: property.real_address || null,
    coordinates: cleanJsonField(property.coordinates),

    // Property details
    property_type: property.property_type || null,
    property_type_code: property.property_type_code || null,
    operation_type: property.operation_type || null,
    age: cleanIntegerField(property.age),
    condition: property.condition || null,
    situation: property.situation || null,
    zonification: property.zonification || null,

    // Room details
    rooms: cleanIntegerField(property.rooms) || 0,
    bathrooms: cleanIntegerField(property.bathrooms) || 0,
    toilets: cleanIntegerField(property.toilets) || 0,
    suites: cleanIntegerField(property.suites) || 0,
    parking_spaces: cleanIntegerField(property.parking_spaces) || 0,
    floors: cleanIntegerField(property.floors) || 0,
    orientation: property.orientation || null,

    // Arrays and JSON
    amenities: cleanArrayField(property.amenities),
    tags: cleanArrayField(property.tags),
    extra_attributes: cleanJsonField(property.extra_attributes),
    contact_info: cleanJsonField(property.contact_info),

    // Flags
    featured: Boolean(property.featured),
    status: cleanIntegerField(property.status) || 0,
    transaction_requirements: property.transaction_requirements || null,
    has_temporary_rent: Boolean(property.has_temporary_rent),
    expenses: cleanNumericField(property.expenses),
    public_url: property.public_url || null,

    // Timestamps
    tokko_created_at: property.tokko_created_at || null,
    tokko_updated_at: property.tokko_updated_at || null,

    // Raw data for debugging
    raw_data: cleanJsonField(property),
  }
}

function cleanPriceField(value: any): string | null {
  if (value === null || value === undefined) return null

  // If it's already a string, return it
  if (typeof value === "string") return value

  // If it's a number, convert to string
  if (typeof value === "number") return value.toString()

  // If it's an object, try to extract a price value
  if (typeof value === "object") {
    if (value.amount) return value.amount.toString()
    if (value.value) return value.value.toString()
    if (value.price) return value.price.toString()
    // Convert object to JSON string as fallback
    return JSON.stringify(value)
  }

  return value?.toString() || null
}

function cleanNumericField(value: any): number | null {
  if (value === null || value === undefined || value === "") return null

  // If it's already a number
  if (typeof value === "number" && !isNaN(value)) return value

  // If it's a string, try to parse
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""))
    return isNaN(parsed) ? null : parsed
  }

  // If it's an object, try to extract numeric value
  if (typeof value === "object") {
    if (value.amount) return cleanNumericField(value.amount)
    if (value.value) return cleanNumericField(value.value)
    if (value.size) return cleanNumericField(value.size)
  }

  return null
}

function cleanIntegerField(value: any): number | null {
  const cleaned = cleanNumericField(value)
  return cleaned ? Math.floor(cleaned) : null
}

function cleanArrayField(value: any): string[] | null {
  if (!value) return null

  if (Array.isArray(value)) {
    return value.map((v) => v?.toString() || "").filter((v) => v.length > 0)
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((v) => v?.toString() || "").filter((v) => v.length > 0)
      }
    } catch {
      // If it's a comma-separated string
      return value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
    }
  }

  return null
}

function cleanJsonField(value: any): any {
  if (value === null || value === undefined) return null

  // If it's already an object, return as-is
  if (typeof value === "object") return value

  // If it's a string, try to parse as JSON
  if (typeof value === "string") {
    if (value.trim() === "") return null

    try {
      return JSON.parse(value)
    } catch {
      // If parsing fails, return as string
      return value
    }
  }

  return value
}

async function verifyMigration() {
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(process.env.DATABASE_URL!)

    const result = await sql`
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE sync_status = 'migrated') as migrated_count,
        COUNT(*) FILTER (WHERE featured = true) as featured_count,
        COUNT(*) FILTER (WHERE main_price IS NOT NULL) as with_price_count,
        COUNT(*) FILTER (WHERE surface IS NOT NULL) as with_surface_count
      FROM properties_cache
    `

    const stats = result[0]

    console.log("📊 Migration verification:")
    console.log(`   - Total properties: ${stats.total_count}`)
    console.log(`   - Successfully migrated: ${stats.migrated_count}`)
    console.log(`   - Featured properties: ${stats.featured_count}`)
    console.log(`   - Properties with price: ${stats.with_price_count}`)
    console.log(`   - Properties with surface: ${stats.with_surface_count}`)

    console.log("✅ Migration verification completed")
  } catch (error) {
    console.error("❌ Migration verification failed:", error)
    throw error
  }
}

// Run migration
migrateSupabaseToNeonRobust().catch(console.error)
