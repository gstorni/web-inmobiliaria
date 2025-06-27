#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔄 MIGRATING IMAGES TO BLOB STORAGE")
console.log("=".repeat(50))

async function migrateImagesToBlob() {
  try {
    // Initialize services
    const { sql } = await import("../lib/neon-client-fixed")
    const { neonImageOptimizationBlob } = await import("../lib/neon-image-optimization-blob")

    // Create blob storage table
    console.log("📋 Step 1: Setting up blob storage schema...")
    await sql.unsafe(`
      -- Create blob storage table if not exists
      CREATE TABLE IF NOT EXISTS neon_blob_storage (
        id VARCHAR(255) PRIMARY KEY,
        original_filename VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        file_data TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        access_count INTEGER DEFAULT 0,
        deleted_at TIMESTAMP WITH TIME ZONE NULL
      );

      -- Add blob ID columns to property images
      ALTER TABLE property_images_neon 
      ADD COLUMN IF NOT EXISTS webp_blob_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS avif_blob_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS thumbnail_blob_id VARCHAR(255);
    `)

    console.log("✅ Schema setup completed")

    // Migrate images in batches
    console.log("\n📋 Step 2: Migrating images to blob storage...")
    let totalMigrated = 0
    let totalErrors = 0
    let totalSpaceSaved = 0

    while (true) {
      const result = await neonImageOptimizationBlob.migrateToBlob(50)

      totalMigrated += result.migrated
      totalErrors += result.errors
      totalSpaceSaved += result.spaceSaved

      console.log(`   Batch: ${result.migrated} migrated, ${result.errors} errors`)

      if (result.migrated === 0) {
        break // No more images to migrate
      }
    }

    console.log("\n📊 Migration Summary:")
    console.log(`   - Total migrated: ${totalMigrated}`)
    console.log(`   - Total errors: ${totalErrors}`)
    console.log(`   - Space saved: ${(totalSpaceSaved / 1024 / 1024).toFixed(2)} MB`)

    // Get storage statistics
    console.log("\n📋 Step 3: Getting storage statistics...")
    const { neonBlobStorage } = await import("../lib/neon-blob-storage")
    const stats = await neonBlobStorage.getStorageStats()

    console.log("📊 Storage Statistics:")
    console.log(`   - Total files: ${stats.totalFiles}`)
    console.log(`   - Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   - Average file size: ${(stats.averageFileSize / 1024).toFixed(2)} KB`)

    console.log("\n✅ MIGRATION COMPLETED SUCCESSFULLY!")
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:", error)
    process.exit(1)
  }
}

migrateImagesToBlob().catch(console.error)
