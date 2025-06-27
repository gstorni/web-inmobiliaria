import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local FIRST
config({ path: resolve(process.cwd(), ".env.local") })

async function fixDatabaseAndImages() {
  console.log("🚀 Starting comprehensive database and image fix...")

  try {
    const { createClient } = await import("@supabase/supabase-js")

    const supabase = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Step 1: Fix the property_images table structure
    console.log("\n🔧 Step 1: Fixing property_images table structure...")

    // Drop and recreate the table with proper constraints
    const fixTableSQL = `
      -- Drop existing table if it exists
      DROP TABLE IF EXISTS property_images CASCADE;
      
      -- Create property_images table with proper constraints
      CREATE TABLE property_images (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        property_id INTEGER NOT NULL,
        original_url TEXT NOT NULL,
        original_description TEXT,
        display_order INTEGER DEFAULT 0,
        webp_url TEXT,
        avif_url TEXT,
        thumbnail_url TEXT,
        original_width INTEGER,
        original_height INTEGER,
        file_size_original INTEGER,
        file_size_webp INTEGER,
        file_size_avif INTEGER,
        processing_status TEXT DEFAULT 'pending',
        processing_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_property_image UNIQUE(property_id, original_url)
      );
      
      -- Create indexes
      CREATE INDEX idx_property_images_property_id ON property_images(property_id);
      CREATE INDEX idx_property_images_status ON property_images(processing_status);
      CREATE INDEX idx_property_images_display_order ON property_images(property_id, display_order);
    `

    const { error: tableError } = await supabase.rpc("exec_sql", { sql: fixTableSQL })

    if (tableError) {
      console.log("❌ Failed to fix table structure:", tableError.message)
      console.log("📝 Please run this SQL manually in your Supabase SQL editor:")
      console.log(fixTableSQL)
      return
    }

    console.log("✅ property_images table structure fixed")

    // Step 2: Check if we have properties in the cache
    console.log("\n📋 Step 2: Checking properties cache...")

    const { data: propertiesCount, error: countError } = await supabase
      .from("properties_cache")
      .select("tokko_id", { count: "exact", head: true })

    if (countError) {
      console.log("❌ Error checking properties:", countError.message)
      return
    }

    console.log(`📊 Found ${propertiesCount || 0} properties in cache`)

    if (!propertiesCount || propertiesCount === 0) {
      console.log("\n🔄 No properties found. Syncing from Tokko API...")

      // Fetch properties from Tokko API and add to cache
      const tokkoUrl = `https://www.tokkobroker.com/api/v1/property/?key=${process.env.TOKKO_API_KEY}&format=json&limit=20&property_type=12,24,14,27`

      const response = await fetch(tokkoUrl)
      if (!response.ok) {
        console.log("❌ Failed to fetch properties from Tokko API")
        return
      }

      const tokkoData = await response.json()
      if (!tokkoData?.objects?.length) {
        console.log("❌ No properties returned from Tokko API")
        return
      }

      console.log(`📥 Fetched ${tokkoData.objects.length} properties from Tokko API`)

      // Transform and insert properties
      let insertedCount = 0
      for (const tokkoProperty of tokkoData.objects) {
        try {
          const transformedProperty = {
            tokko_id: tokkoProperty.id,
            title: tokkoProperty.publication_title || tokkoProperty.type?.name || "Propiedad Industrial",
            description: tokkoProperty.description || "",
            reference_code: `REF-${tokkoProperty.id}`,
            prices: tokkoProperty.price
              ? [
                  {
                    operation: tokkoProperty.operation_type || "Venta",
                    price: tokkoProperty.price,
                    currency: tokkoProperty.currency || "USD",
                    formatted: `${tokkoProperty.currency || "USD"} ${tokkoProperty.price?.toLocaleString() || "0"}`,
                  },
                ]
              : [],
            main_price: tokkoProperty.price
              ? {
                  operation: tokkoProperty.operation_type || "Venta",
                  price: tokkoProperty.price,
                  currency: tokkoProperty.currency || "USD",
                  formatted: `${tokkoProperty.currency || "USD"} ${tokkoProperty.price?.toLocaleString() || "0"}`,
                }
              : null,
            available_operations: [tokkoProperty.operation_type || "Venta"],
            surface: tokkoProperty.surface || 0,
            covered_surface: tokkoProperty.roofed_surface || 0,
            location_name: tokkoProperty.location?.name || "",
            address: tokkoProperty.address || "",
            property_type: tokkoProperty.type?.name || "",
            property_type_code: tokkoProperty.type?.id?.toString() || "",
            operation_type: tokkoProperty.operation_type || "Venta",
            rooms: tokkoProperty.rooms || 0,
            bathrooms: tokkoProperty.bathrooms || 0,
            parking_spaces: tokkoProperty.garages || 0,
            featured: tokkoProperty.is_starred || false,
            status: 1,
            images: [], // Will be populated later
            sync_status: "synced",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          const { error: insertError } = await supabase.from("properties_cache").upsert(transformedProperty, {
            onConflict: "tokko_id",
          })

          if (insertError) {
            console.log(`❌ Failed to insert property ${tokkoProperty.id}: ${insertError.message}`)
          } else {
            insertedCount++
          }
        } catch (error: any) {
          console.log(`❌ Error processing property ${tokkoProperty.id}: ${error.message}`)
        }
      }

      console.log(`✅ Inserted ${insertedCount} properties into cache`)
    }

    // Step 3: Now sync images for properties
    console.log("\n📸 Step 3: Syncing images for properties...")

    const { data: sampleProperties, error: propError } = await supabase
      .from("properties_cache")
      .select("tokko_id, title")
      .limit(10)

    if (propError || !sampleProperties?.length) {
      console.log("❌ Still no properties found after sync attempt")
      return
    }

    console.log(`🔄 Processing images for ${sampleProperties.length} properties...`)

    let processedProperties = 0
    let totalImagesAdded = 0

    for (const property of sampleProperties) {
      try {
        console.log(`\n🔍 Processing property ${property.tokko_id}: ${property.title}`)

        // Get property details from Tokko API
        const propertyUrl = `https://www.tokkobroker.com/api/v1/property/${property.tokko_id}/?key=${process.env.TOKKO_API_KEY}&format=json`
        const propertyResponse = await fetch(propertyUrl)

        if (!propertyResponse.ok) {
          console.log(`   ❌ Failed to fetch property details: ${propertyResponse.status}`)
          continue
        }

        const tokkoProperty = await propertyResponse.json()

        if (tokkoProperty?.photos && tokkoProperty.photos.length > 0) {
          console.log(`   📸 Found ${tokkoProperty.photos.length} images`)

          // Insert images one by one to handle conflicts better
          let imagesAdded = 0
          for (let i = 0; i < tokkoProperty.photos.length; i++) {
            const photo = tokkoProperty.photos[i]
            try {
              const { error: insertError } = await supabase.from("property_images").insert({
                property_id: property.tokko_id,
                original_url: photo.image,
                original_description: photo.description || "",
                display_order: i,
                processing_status: "completed", // Mark as completed since we're using original URLs
              })

              if (insertError) {
                if (insertError.message.includes("duplicate")) {
                  // Image already exists, that's fine
                  console.log(`   ℹ️ Image ${i + 1} already exists`)
                } else {
                  console.log(`   ❌ Failed to insert image ${i + 1}: ${insertError.message}`)
                }
              } else {
                imagesAdded++
              }
            } catch (error: any) {
              console.log(`   ❌ Error inserting image ${i + 1}: ${error.message}`)
            }
          }

          console.log(`   ✅ Added ${imagesAdded} new images`)
          totalImagesAdded += imagesAdded
          processedProperties++

          // Update the property with its images
          const propertyImages = tokkoProperty.photos.map((photo: any, index: number) => ({
            url: photo.image,
            description: photo.description || "",
          }))

          const { error: updateError } = await supabase
            .from("properties_cache")
            .update({ images: propertyImages })
            .eq("tokko_id", property.tokko_id)

          if (updateError) {
            console.log(`   ❌ Failed to update property with images: ${updateError.message}`)
          } else {
            console.log(`   ✅ Updated property with ${propertyImages.length} image URLs`)
          }
        } else {
          console.log(`   ℹ️ No images found`)
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch (error: any) {
        console.log(`   ❌ Error processing property ${property.tokko_id}: ${error.message}`)
      }
    }

    console.log(`\n📊 Final summary:`)
    console.log(`   Properties processed: ${processedProperties}/${sampleProperties.length}`)
    console.log(`   Total images added: ${totalImagesAdded}`)

    // Step 4: Verify the setup
    console.log("\n🔍 Step 4: Verifying the setup...")

    const { data: finalCheck, error: finalError } = await supabase
      .from("properties_cache")
      .select("tokko_id, title, images")
      .not("images", "is", null)
      .limit(3)

    if (finalError) {
      console.log("❌ Error in final verification:", finalError.message)
    } else if (finalCheck?.length) {
      console.log(`✅ Found ${finalCheck.length} properties with images:`)
      finalCheck.forEach((prop) => {
        console.log(`   - ${prop.title}: ${prop.images?.length || 0} images`)
      })
    } else {
      console.log("⚠️ No properties with images found")
    }

    console.log("\n🎉 Database and image fix completed!")
    console.log("\n📋 Next steps:")
    console.log("1. Restart your Next.js development server: npm run dev")
    console.log("2. Visit /propiedades to see if properties and images are now displaying")
    console.log("3. Check the browser console for any remaining errors")
  } catch (error: any) {
    console.log("❌ Critical error during fix:", error.message)
    console.log("Stack trace:", error.stack)
  }
}

// Run the fix
fixDatabaseAndImages()
