#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔄 SYNCING PROPERTIES TO NEON CACHE")
console.log("=".repeat(50))

async function syncPropertiesToNeon() {
  try {
    // Check if we have a Tokko API key
    if (!process.env.TOKKO_API_KEY) {
      console.log("ℹ️ No Tokko API key found. Skipping property sync.")
      console.log("   You can add properties later when the API key is configured.")
      return
    }

    // Import the enhanced cache service
    const { enhancedMultiTierCache } = await import("../lib/enhanced-multi-tier-cache")
    const { neon } = await import("@neondatabase/serverless")

    const sql = neon(process.env.DATABASE_URL!)

    console.log("\n📡 Fetching properties from Tokko API...")

    // Get a sample of properties to start with
    const properties = await enhancedMultiTierCache.searchProperties({
      limit: "50",
      featured: "true",
    })

    if (properties.results && properties.results.length > 0) {
      console.log(`📦 Syncing ${properties.results.length} properties...`)

      let synced = 0
      let errors = 0

      for (const property of properties.results) {
        try {
          // Store in Neon cache
          await sql`
            INSERT INTO properties_cache (
              tokko_id, title, description, main_price, surface, 
              location_name, property_type_code, operation_type, featured,
              raw_data, cached_at, sync_status
            ) VALUES (
              ${property.id}, ${property.title}, ${property.description}, 
              ${property.price}, ${property.surface}, ${property.location},
              ${property.type}, ${property.operation}, ${property.featured || false},
              ${JSON.stringify(property)}, NOW(), 'synced'
            )
            ON CONFLICT (tokko_id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              main_price = EXCLUDED.main_price,
              surface = EXCLUDED.surface,
              location_name = EXCLUDED.location_name,
              property_type_code = EXCLUDED.property_type_code,
              operation_type = EXCLUDED.operation_type,
              featured = EXCLUDED.featured,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW(),
              sync_status = 'synced'
          `

          // Process images if available
          if (property.images && property.images.length > 0) {
            for (const [index, image] of property.images.entries()) {
              await sql`
                INSERT INTO property_images_neon (
                  property_id, original_url, original_description, display_order,
                  processing_status
                ) VALUES (
                  ${property.id}, ${image.url}, ${image.description || ""}, 
                  ${index}, 'pending'
                )
                ON CONFLICT (property_id, original_url) DO NOTHING
              `
            }
          }

          synced++
          if (synced % 10 === 0) {
            console.log(`   Synced ${synced}/${properties.results.length} properties...`)
          }
        } catch (error) {
          console.warn(`Failed to sync property ${property.id}:`, error.message)
          errors++
        }
      }

      console.log(`\n✅ Property sync completed:`)
      console.log(`   - Synced: ${synced}`)
      console.log(`   - Errors: ${errors}`)
      console.log(`   - Total: ${properties.results.length}`)

      // Update performance metrics
      await sql`
        INSERT INTO performance_metrics (metric_type, metric_value, metadata)
        VALUES ('properties_synced', ${synced}, ${JSON.stringify({ errors, total: properties.results.length })})
      `
    } else {
      console.log("ℹ️ No properties found to sync")
    }
  } catch (error) {
    console.error("❌ Property sync failed:", error)
    process.exit(1)
  }
}

// Run sync
syncPropertiesToNeon().catch(console.error)
