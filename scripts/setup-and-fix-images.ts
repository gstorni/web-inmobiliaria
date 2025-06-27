import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables from .env.local FIRST
config({ path: resolve(process.cwd(), ".env.local") })

async function standaloneImageFix() {
  console.log("🚀 Starting standalone image system repair...")

  // Step 1: Check environment variables
  console.log("\n📋 Step 1: Checking environment variables...")

  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TOKKO_API_KEY",
  ]

  console.log("Environment variables found:")
  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      console.log(`✅ ${varName}: ${value.substring(0, 20)}...`)
    } else {
      console.log(`❌ ${varName}: MISSING`)
    }
  }

  const missingVars = requiredVars.filter((varName) => !process.env[varName])
  if (missingVars.length > 0) {
    console.log(`\n❌ Missing required environment variables: ${missingVars.join(", ")}`)
    console.log("Please check your .env.local file.")
    return
  }

  // Step 2: Test Supabase connection using direct client creation
  console.log("\n🔗 Step 2: Testing Supabase connection...")

  try {
    const { createClient } = await import("@supabase/supabase-js")

    const supabase = createClient(/* Supabase URL removed */!, /* Supabase service key removed */!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await supabase.from("properties_cache").select("count").limit(1)
    if (error) {
      console.log("⚠️ Supabase connection issue:", error.message)
      return
    } else {
      console.log("✅ Supabase connection successful")
    }

    // Step 3: Test Tokko API connection
    console.log("\n🌐 Step 3: Testing Tokko API connection...")

    const tokkoUrl = `https://www.tokkobroker.com/api/v1/property/?key=${process.env.TOKKO_API_KEY}&format=json&limit=1`

    const response = await fetch(tokkoUrl)
    if (!response.ok) {
      console.log("❌ Tokko API connection failed:", response.status, response.statusText)
      return
    }

    const tokkoData = await response.json()
    if (tokkoData && tokkoData.objects) {
      console.log("✅ Tokko API connection successful")
    } else {
      console.log("⚠️ Tokko API returned unexpected response")
      return
    }

    // Step 4: Check/create property_images table
    console.log("\n📋 Step 4: Checking property_images table...")

    const { data: tableCheck, error: tableError } = await supabase.from("property_images").select("*").limit(1)

    if (tableError && tableError.message.includes("does not exist")) {
      console.log("🔧 Creating property_images table...")

      // Create the table using raw SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS property_images (
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
          UNIQUE(property_id, original_url)
        );
        
        CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
        CREATE INDEX IF NOT EXISTS idx_property_images_status ON property_images(processing_status);
      `

      // Try to create the table
      const { error: createError } = await supabase.rpc("exec_sql", { sql: createTableSQL })

      if (createError) {
        console.log("❌ Failed to create property_images table with RPC:", createError.message)
        console.log("📝 Please create the table manually in your Supabase dashboard:")
        console.log(createTableSQL)
        return
      }

      console.log("✅ property_images table created successfully")
    } else if (tableError) {
      console.log("❌ Error checking property_images table:", tableError.message)
      return
    } else {
      console.log("✅ property_images table exists")
    }

    // Step 5: Get sample properties and sync their images
    console.log("\n🔄 Step 5: Syncing images from sample properties...")

    const { data: sampleProperties, error: propError } = await supabase
      .from("properties_cache")
      .select("tokko_id, title")
      .limit(5)

    if (propError || !sampleProperties?.length) {
      console.log("⚠️ No properties found in cache. You may need to sync properties first.")
      console.log("Error:", propError?.message)
      return
    }

    console.log(`📸 Processing images for ${sampleProperties.length} sample properties...`)

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

          // Prepare image data for insertion
          const imageInserts = tokkoProperty.photos.map((photo: any, index: number) => ({
            property_id: property.tokko_id,
            original_url: photo.image,
            original_description: photo.description || "",
            display_order: index,
            processing_status: "pending",
          }))

          // Insert images
          const { error: insertError } = await supabase.from("property_images").upsert(imageInserts, {
            onConflict: "property_id,original_url",
            ignoreDuplicates: true,
          })

          if (insertError) {
            console.log(`   ❌ Failed to insert images: ${insertError.message}`)
          } else {
            console.log(`   ✅ Added ${imageInserts.length} images to processing queue`)
            totalImagesAdded += imageInserts.length
            processedProperties++
          }
        } else {
          console.log(`   ℹ️ No images found`)
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error: any) {
        console.log(`   ❌ Error processing property ${property.tokko_id}: ${error.message}`)
      }
    }

    console.log(`\n📊 Image sync summary:`)
    console.log(`   Properties processed: ${processedProperties}/${sampleProperties.length}`)
    console.log(`   Total images added: ${totalImagesAdded}`)

    // Step 6: Update properties_cache with image URLs
    console.log("\n🔄 Step 6: Updating properties with image URLs...")

    const { data: allImages, error: imgError } = await supabase
      .from("property_images")
      .select("property_id, original_url, original_description, display_order")
      .order("property_id")
      .order("display_order")

    if (imgError) {
      console.log("❌ Error fetching images:", imgError.message)
    } else if (allImages?.length) {
      // Group images by property
      const imagesByProperty = allImages.reduce((acc: any, img: any) => {
        if (!acc[img.property_id]) acc[img.property_id] = []
        acc[img.property_id].push({
          url: img.original_url,
          description: img.original_description || "",
        })
        return acc
      }, {})

      // Update properties with their images
      let updatedProperties = 0
      for (const [propertyId, images] of Object.entries(imagesByProperty)) {
        const { error: updateError } = await supabase
          .from("properties_cache")
          .update({ images })
          .eq("tokko_id", Number.parseInt(propertyId))

        if (updateError) {
          console.log(`❌ Failed to update property ${propertyId}: ${updateError.message}`)
        } else {
          updatedProperties++
        }
      }

      console.log(`✅ Updated ${updatedProperties} properties with image URLs`)
    } else {
      console.log("ℹ️ No images found to update")
    }

    console.log("\n🎉 Standalone image system repair completed!")
    console.log("\n📋 Next steps:")
    console.log("1. Check the /propiedades page to see if images are displaying")
    console.log("2. The images should now appear on property cards")
    console.log("3. Check the browser console for any image loading errors")
  } catch (error: any) {
    console.log("❌ Critical error during image repair:", error.message)
    console.log("Stack trace:", error.stack)
  }
}

// Run the standalone fix
standaloneImageFix()
