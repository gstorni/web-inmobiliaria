import { config } from "dotenv"
import { resolve } from "path"
import { secureTokkoClient } from "@/lib/enhanced-tokko-client"
import { imageOptimizationService } from "@/lib/image-optimization-service"

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") })

async function diagnoseAndFixImageSystem() {
  console.log("🔍 Starting comprehensive image system diagnosis...")

  try {
    // Step 1: Check if property_images table exists and has correct structure
    console.log("\n📋 Step 1: Checking property_images table structure...")

    const { data: tableInfo, error: tableError } = await supabaseAdmin.from("property_images").select("*").limit(1)

    if (tableError) {
      console.error("❌ property_images table issue:", tableError.message)
      console.log("🔧 Creating property_images table...")

      // Create the table if it doesn't exist
      const { error: createError } = await supabaseAdmin.rpc("exec_sql", {
        sql: `
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
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
          CREATE INDEX IF NOT EXISTS idx_property_images_status ON property_images(processing_status);
        `,
      })

      if (createError) {
        console.error("❌ Failed to create property_images table:", createError.message)
        return
      }
      console.log("✅ property_images table created successfully")
    } else {
      console.log("✅ property_images table exists")
    }

    // Step 2: Check current image data
    console.log("\n📊 Step 2: Analyzing current image data...")

    const { count: totalImages } = await supabaseAdmin
      .from("property_images")
      .select("*", { count: "exact", head: true })

    const { count: pendingImages } = await supabaseAdmin
      .from("property_images")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "pending")

    const { count: completedImages } = await supabaseAdmin
      .from("property_images")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "completed")

    const { count: errorImages } = await supabaseAdmin
      .from("property_images")
      .select("*", { count: "exact", head: true })
      .eq("processing_status", "error")

    console.log(`📈 Image Statistics:`)
    console.log(`   Total images: ${totalImages || 0}`)
    console.log(`   Pending: ${pendingImages || 0}`)
    console.log(`   Completed: ${completedImages || 0}`)
    console.log(`   Errors: ${errorImages || 0}`)

    // Step 3: Check if properties have image data
    console.log("\n🏢 Step 3: Checking properties with missing images...")

    const { data: propertiesWithoutImages, error: propError } = await supabaseAdmin
      .from("properties_cache")
      .select("tokko_id, title")
      .is("images", null)
      .limit(10)

    if (propError) {
      console.error("❌ Error checking properties:", propError.message)
    } else {
      console.log(`🔍 Found ${propertiesWithoutImages?.length || 0} properties without images (showing first 10)`)
      propertiesWithoutImages?.forEach((prop) => {
        console.log(`   - Property ${prop.tokko_id}: ${prop.title}`)
      })
    }

    // Step 4: Sync images from a few properties to test the system
    console.log("\n🔄 Step 4: Testing image sync with sample properties...")

    const { data: sampleProperties, error: sampleError } = await supabaseAdmin
      .from("properties_cache")
      .select("tokko_id")
      .limit(5)

    if (sampleError || !sampleProperties?.length) {
      console.error("❌ No sample properties found for testing")
      return
    }

    for (const property of sampleProperties) {
      try {
        console.log(`🔍 Testing image sync for property ${property.tokko_id}...`)

        // Get property from Tokko API to check for images
        const tokkoProperty = await secureTokkoClient.getProperty(property.tokko_id)

        if (tokkoProperty?.photos && tokkoProperty.photos.length > 0) {
          console.log(`📸 Found ${tokkoProperty.photos.length} images for property ${property.tokko_id}`)

          // Insert images into property_images table
          const imageInserts = tokkoProperty.photos.map((photo, index) => ({
            property_id: property.tokko_id,
            original_url: photo.image,
            original_description: photo.description || "",
            display_order: index,
            processing_status: "pending",
          }))

          const { error: insertError } = await supabaseAdmin.from("property_images").upsert(imageInserts, {
            onConflict: "property_id,original_url",
            ignoreDuplicates: true,
          })

          if (insertError) {
            console.error(`❌ Failed to insert images for property ${property.tokko_id}:`, insertError.message)
          } else {
            console.log(`✅ Inserted ${imageInserts.length} images for property ${property.tokko_id}`)
          }
        } else {
          console.log(`ℹ️ No images found for property ${property.tokko_id}`)
        }
      } catch (error: any) {
        console.error(`❌ Error processing property ${property.tokko_id}:`, error.message)
      }
    }

    // Step 5: Test image processing
    console.log("\n🖼️ Step 5: Testing image processing...")

    const { data: testImages, error: testError } = await supabaseAdmin
      .from("property_images")
      .select("*")
      .eq("processing_status", "pending")
      .limit(3)

    if (testError || !testImages?.length) {
      console.log("ℹ️ No pending images found for processing test")
    } else {
      console.log(`🔄 Processing ${testImages.length} test images...`)

      try {
        const result = await imageOptimizationService.processImagesWithCheckpoint(3, `test-${Date.now()}`, false)
        console.log(`✅ Image processing test completed: ${result.processed} processed, ${result.errors} errors`)
      } catch (error: any) {
        console.error("❌ Image processing test failed:", error.message)
      }
    }

    // Step 6: Update properties_cache with processed images
    console.log("\n🔄 Step 6: Updating properties_cache with processed images...")

    const { data: propertiesWithImages, error: imgError } = await supabaseAdmin
      .from("property_images")
      .select("property_id, webp_url, avif_url, original_url, original_description, display_order")
      .eq("processing_status", "completed")
      .order("property_id")
      .order("display_order")

    if (imgError) {
      console.error("❌ Error fetching processed images:", imgError.message)
    } else if (propertiesWithImages?.length) {
      // Group images by property_id
      const imagesByProperty = propertiesWithImages.reduce(
        (acc, img) => {
          if (!acc[img.property_id]) acc[img.property_id] = []
          acc[img.property_id].push({
            url: img.avif_url || img.webp_url || img.original_url,
            description: img.original_description || "",
          })
          return acc
        },
        {} as Record<number, any[]>,
      )

      // Update each property with its images
      for (const [propertyId, images] of Object.entries(imagesByProperty)) {
        const { error: updateError } = await supabaseAdmin
          .from("properties_cache")
          .update({ images })
          .eq("tokko_id", Number.parseInt(propertyId))

        if (updateError) {
          console.error(`❌ Failed to update images for property ${propertyId}:`, updateError.message)
        } else {
          console.log(`✅ Updated ${images.length} images for property ${propertyId}`)
        }
      }
    }

    console.log("\n🎉 Image system diagnosis and repair completed!")
    console.log("\n📋 Summary:")
    console.log(`   - Total images in system: ${totalImages || 0}`)
    console.log(`   - Pending processing: ${pendingImages || 0}`)
    console.log(`   - Successfully processed: ${completedImages || 0}`)
    console.log(`   - Processing errors: ${errorImages || 0}`)
  } catch (error: any) {
    console.error("❌ Critical error in image system diagnosis:", error.message)
  }
}

// Run the diagnosis
diagnoseAndFixImageSystem()
