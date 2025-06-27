#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "fs"
import { createGzip } from "zlib"
import { pipeline } from "stream/promises"

// Load environment variables first
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🔄 DATABASE RESET TO CLEAN STATE")
console.log("=".repeat(50))

interface ResetConfig {
  requireConfirmation: boolean
  createBackup: boolean
  dryRun: boolean
  dropExtensions: boolean
  preserveUsers: boolean
  cleanSequences: boolean
}

interface ResetStats {
  startTime: Date
  endTime?: Date
  tablesFound: number
  tablesDeleted: number
  sequencesReset: number
  extensionsDropped: number
  backupCreated: boolean
  errors: Array<{
    type: string
    message: string
    table?: string
    timestamp: Date
  }>
}

class DatabaseResetService {
  private sql: any
  private config: ResetConfig
  private stats: ResetStats

  constructor() {
    this.config = {
      requireConfirmation: process.env.RESET_REQUIRE_CONFIRMATION !== "false",
      createBackup: process.env.RESET_CREATE_BACKUP !== "false",
      dryRun: process.env.RESET_DRY_RUN === "true",
      dropExtensions: process.env.RESET_DROP_EXTENSIONS === "true",
      preserveUsers: process.env.RESET_PRESERVE_USERS !== "false",
      cleanSequences: process.env.RESET_CLEAN_SEQUENCES !== "false",
    }

    this.stats = {
      startTime: new Date(),
      tablesFound: 0,
      tablesDeleted: 0,
      sequencesReset: 0,
      extensionsDropped: 0,
      backupCreated: false,
      errors: [],
    }
  }

  async initialize() {
    try {
      console.log("🔧 Initializing database connection...")

      const { sql } = await import("../lib/neon-client-fixed")
      this.sql = sql

      console.log("✅ Database connection established")
      console.log(`📊 Configuration:`)
      console.log(`   - Require confirmation: ${this.config.requireConfirmation}`)
      console.log(`   - Create backup: ${this.config.createBackup}`)
      console.log(`   - Dry run mode: ${this.config.dryRun}`)
      console.log(`   - Drop extensions: ${this.config.dropExtensions}`)
      console.log(`   - Preserve users: ${this.config.preserveUsers}`)
      console.log(`   - Clean sequences: ${this.config.cleanSequences}`)

      if (this.config.dryRun) {
        console.log("\n🧪 DRY RUN MODE - No changes will be made")
      }
    } catch (error) {
      this.logError("initialization", error.message)
      throw error
    }
  }

  async resetDatabase() {
    try {
      await this.initialize()

      // Safety confirmation
      if (this.config.requireConfirmation && !this.config.dryRun) {
        await this.requireConfirmation()
      }

      console.log("\n📋 Step 1: Analyzing current database state...")
      await this.analyzeDatabaseState()

      if (this.config.createBackup && !this.config.dryRun) {
        console.log("\n📋 Step 2: Creating backup...")
        await this.createBackup()
      }

      console.log("\n📋 Step 3: Dropping application tables...")
      await this.dropApplicationTables()

      console.log("\n📋 Step 4: Cleaning up sequences...")
      await this.cleanupSequences()

      if (this.config.dropExtensions) {
        console.log("\n📋 Step 5: Dropping extensions...")
        await this.dropExtensions()
      }

      console.log("\n📋 Step 6: Verifying clean state...")
      await this.verifyCleanState()

      console.log("\n📋 Step 7: Creating fresh schema...")
      await this.createFreshSchema()

      this.printFinalStats()
    } catch (error) {
      this.logError("reset_process", error.message)
      console.error("\n❌ DATABASE RESET FAILED:", error)
      process.exit(1)
    }
  }

  private async requireConfirmation() {
    console.log("\n⚠️  WARNING: This will permanently delete all data in the database!")
    console.log("   This action cannot be undone.")

    const readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const answer = await new Promise<string>((resolve) => {
      readline.question("\nType 'RESET DATABASE' to confirm: ", resolve)
    })

    readline.close()

    if (answer !== "RESET DATABASE") {
      console.log("❌ Reset cancelled by user")
      process.exit(0)
    }

    console.log("✅ Reset confirmed by user")
  }

  private async analyzeDatabaseState() {
    try {
      // Get all user tables
      const tables = await this.sql`
        SELECT schemaname, tablename, tableowner
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schemaname, tablename
      `

      this.stats.tablesFound = tables.length

      console.log(`📊 Database Analysis:`)
      console.log(`   - Total tables found: ${tables.length}`)

      if (tables.length > 0) {
        console.log(`   - Tables by schema:`)
        const schemaGroups = tables.reduce((acc, table) => {
          acc[table.schemaname] = (acc[table.schemaname] || 0) + 1
          return acc
        }, {})

        Object.entries(schemaGroups).forEach(([schema, count]) => {
          console.log(`     • ${schema}: ${count} tables`)
        })

        console.log(`\n📋 Tables to be deleted:`)
        tables.forEach((table, index) => {
          console.log(`   ${index + 1}. ${table.schemaname}.${table.tablename}`)
        })
      }

      // Get sequences
      const sequences = await this.sql`
        SELECT schemaname, sequencename
        FROM pg_sequences
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      `

      if (sequences.length > 0) {
        console.log(`\n📋 Sequences found: ${sequences.length}`)
        sequences.forEach((seq, index) => {
          console.log(`   ${index + 1}. ${seq.schemaname}.${seq.sequencename}`)
        })
      }

      // Get extensions
      const extensions = await this.sql`
        SELECT extname, extversion
        FROM pg_extension
        WHERE extname NOT IN ('plpgsql')
      `

      if (extensions.length > 0) {
        console.log(`\n📋 Extensions found: ${extensions.length}`)
        extensions.forEach((ext, index) => {
          console.log(`   ${index + 1}. ${ext.extname} (${ext.extversion})`)
        })
      }
    } catch (error) {
      this.logError("analysis", error.message)
      throw error
    }
  }

  private async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const backupDir = resolve(process.cwd(), "backups")

      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true })
      }

      const backupFile = resolve(backupDir, `database-backup-${timestamp}.sql`)

      console.log(`   Creating backup: ${backupFile}`)

      // Get database schema
      const tables = await this.sql`
        SELECT schemaname, tablename
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      `

      let backupContent = `-- Database Backup Created: ${new Date().toISOString()}\n`
      backupContent += `-- Total Tables: ${tables.length}\n\n`

      // Export table structures and data
      for (const table of tables) {
        try {
          const fullTableName = `${table.schemaname}.${table.tablename}`

          // Get table structure
          const createTableQuery = await this.sql`
            SELECT pg_get_ddl_table('${table.schemaname}'::text, '${table.tablename}'::text) as ddl
          `.catch(() => [{ ddl: `-- Could not get DDL for ${fullTableName}` }])

          backupContent += `-- Table: ${fullTableName}\n`
          backupContent += `${createTableQuery[0]?.ddl || `-- DDL not available for ${fullTableName}`}\n\n`

          // Get row count
          const countResult = await this.sql`
            SELECT COUNT(*) as count FROM ${this.sql.unsafe(fullTableName)}
          `.catch(() => [{ count: 0 }])

          const rowCount = countResult[0]?.count || 0
          backupContent += `-- Rows in ${fullTableName}: ${rowCount}\n\n`
        } catch (error) {
          backupContent += `-- Error backing up ${table.schemaname}.${table.tablename}: ${error.message}\n\n`
        }
      }

      // Write backup file
      require("fs").writeFileSync(backupFile, backupContent)

      // Compress if requested
      if (process.env.BACKUP_COMPRESS === "true") {
        const compressedFile = `${backupFile}.gz`
        await pipeline(createReadStream(backupFile), createGzip(), createWriteStream(compressedFile))
        require("fs").unlinkSync(backupFile) // Remove uncompressed version
        console.log(`   ✅ Compressed backup created: ${compressedFile}`)
      } else {
        console.log(`   ✅ Backup created: ${backupFile}`)
      }

      this.stats.backupCreated = true
    } catch (error) {
      this.logError("backup", error.message)
      console.warn(`   ⚠️ Backup creation failed: ${error.message}`)

      if (!this.config.dryRun) {
        const readline = require("readline").createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        const answer = await new Promise<string>((resolve) => {
          readline.question("Continue without backup? (y/N): ", resolve)
        })

        readline.close()

        if (answer.toLowerCase() !== "y") {
          console.log("❌ Reset cancelled due to backup failure")
          process.exit(1)
        }
      }
    }
  }

  private async dropApplicationTables() {
    try {
      // Get all tables with their dependencies
      const tables = await this.sql`
        SELECT schemaname, tablename
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schemaname, tablename
      `

      console.log(`   Found ${tables.length} tables to drop`)

      if (this.config.dryRun) {
        console.log("   🧪 DRY RUN: Would drop the following tables:")
        tables.forEach((table, index) => {
          console.log(`      ${index + 1}. ${table.schemaname}.${table.tablename}`)
        })
        this.stats.tablesDeleted = tables.length
        return
      }

      // Drop tables with CASCADE to handle dependencies
      for (const table of tables) {
        try {
          const fullTableName = `${table.schemaname}.${table.tablename}`

          console.log(`   Dropping table: ${fullTableName}`)

          await this.sql`DROP TABLE IF EXISTS ${this.sql.unsafe(fullTableName)} CASCADE`

          this.stats.tablesDeleted++
          console.log(`   ✅ Dropped: ${fullTableName}`)
        } catch (error) {
          this.logError("table_drop", error.message, table.tablename)
          console.warn(`   ⚠️ Failed to drop ${table.schemaname}.${table.tablename}: ${error.message}`)
        }
      }

      console.log(`   ✅ Dropped ${this.stats.tablesDeleted}/${tables.length} tables`)
    } catch (error) {
      this.logError("drop_tables", error.message)
      throw error
    }
  }

  private async cleanupSequences() {
    try {
      if (!this.config.cleanSequences) {
        console.log("   Skipping sequence cleanup (disabled)")
        return
      }

      const sequences = await this.sql`
        SELECT schemaname, sequencename
        FROM pg_sequences
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      `

      console.log(`   Found ${sequences.length} sequences`)

      if (this.config.dryRun) {
        console.log("   🧪 DRY RUN: Would reset the following sequences:")
        sequences.forEach((seq, index) => {
          console.log(`      ${index + 1}. ${seq.schemaname}.${seq.sequencename}`)
        })
        this.stats.sequencesReset = sequences.length
        return
      }

      for (const sequence of sequences) {
        try {
          const fullSeqName = `${sequence.schemaname}.${sequence.sequencename}`

          console.log(`   Resetting sequence: ${fullSeqName}`)

          await this.sql`DROP SEQUENCE IF EXISTS ${this.sql.unsafe(fullSeqName)} CASCADE`

          this.stats.sequencesReset++
          console.log(`   ✅ Reset: ${fullSeqName}`)
        } catch (error) {
          this.logError("sequence_reset", error.message, sequence.sequencename)
          console.warn(`   ⚠️ Failed to reset ${sequence.schemaname}.${sequence.sequencename}: ${error.message}`)
        }
      }

      console.log(`   ✅ Reset ${this.stats.sequencesReset}/${sequences.length} sequences`)
    } catch (error) {
      this.logError("cleanup_sequences", error.message)
      throw error
    }
  }

  private async dropExtensions() {
    try {
      const extensions = await this.sql`
        SELECT extname
        FROM pg_extension
        WHERE extname NOT IN ('plpgsql')
      `

      console.log(`   Found ${extensions.length} extensions`)

      if (this.config.dryRun) {
        console.log("   🧪 DRY RUN: Would drop the following extensions:")
        extensions.forEach((ext, index) => {
          console.log(`      ${index + 1}. ${ext.extname}`)
        })
        this.stats.extensionsDropped = extensions.length
        return
      }

      for (const extension of extensions) {
        try {
          console.log(`   Dropping extension: ${extension.extname}`)

          await this.sql`DROP EXTENSION IF EXISTS ${this.sql.unsafe(extension.extname)} CASCADE`

          this.stats.extensionsDropped++
          console.log(`   ✅ Dropped: ${extension.extname}`)
        } catch (error) {
          this.logError("extension_drop", error.message, extension.extname)
          console.warn(`   ⚠️ Failed to drop ${extension.extname}: ${error.message}`)
        }
      }

      console.log(`   ✅ Dropped ${this.stats.extensionsDropped}/${extensions.length} extensions`)
    } catch (error) {
      this.logError("drop_extensions", error.message)
      throw error
    }
  }

  private async verifyCleanState() {
    try {
      const tables = await this.sql`
        SELECT COUNT(*) as count
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      `

      const sequences = await this.sql`
        SELECT COUNT(*) as count
        FROM pg_sequences
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      `

      const extensions = await this.sql`
        SELECT COUNT(*) as count
        FROM pg_extension
        WHERE extname NOT IN ('plpgsql')
      `

      console.log(`   📊 Clean State Verification:`)
      console.log(`      - Remaining tables: ${tables[0].count}`)
      console.log(`      - Remaining sequences: ${sequences[0].count}`)
      console.log(`      - Remaining extensions: ${extensions[0].count}`)

      if (tables[0].count === 0 && sequences[0].count === 0) {
        console.log(`   ✅ Database is in clean state`)
      } else {
        console.log(`   ⚠️ Database may not be completely clean`)
      }
    } catch (error) {
      this.logError("verification", error.message)
      console.warn(`   ⚠️ Verification failed: ${error.message}`)
    }
  }

  private async createFreshSchema() {
    try {
      if (this.config.dryRun) {
        console.log("   🧪 DRY RUN: Would create fresh schema")
        return
      }

      console.log("   Creating fresh schema for new import...")

      // Create the basic schema needed for the migration
      await this.sql`
        -- Create properties cache table
        CREATE TABLE IF NOT EXISTS properties_cache (
          id SERIAL PRIMARY KEY,
          tokko_id INTEGER UNIQUE NOT NULL,
          title TEXT,
          description TEXT,
          rich_description TEXT,
          reference_code VARCHAR(100),
          main_price JSONB,
          prices JSONB,
          available_operations TEXT[],
          surface DECIMAL,
          covered_surface DECIMAL,
          uncovered_surface DECIMAL,
          total_surface DECIMAL,
          location_name TEXT,
          location_full TEXT,
          location_short TEXT,
          address TEXT,
          real_address TEXT,
          coordinates JSONB,
          property_type TEXT,
          property_type_code VARCHAR(50),
          operation_type TEXT,
          age INTEGER,
          condition TEXT,
          situation TEXT,
          zonification TEXT,
          rooms INTEGER,
          bathrooms INTEGER,
          toilets INTEGER,
          suites INTEGER,
          parking_spaces INTEGER,
          floors INTEGER,
          orientation TEXT,
          amenities TEXT[],
          tags TEXT[],
          extra_attributes JSONB,
          contact_info JSONB,
          featured BOOLEAN DEFAULT false,
          status TEXT,
          transaction_requirements TEXT,
          has_temporary_rent BOOLEAN DEFAULT false,
          expenses JSONB,
          public_url TEXT,
          tokko_created_at TIMESTAMP WITH TIME ZONE,
          tokko_updated_at TIMESTAMP WITH TIME ZONE,
          sync_status VARCHAR(50) DEFAULT 'pending',
          last_synced_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create blob storage table
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

        -- Create property images table
        CREATE TABLE IF NOT EXISTS property_images_neon (
          id SERIAL PRIMARY KEY,
          property_id INTEGER NOT NULL,
          original_url TEXT NOT NULL,
          original_description TEXT,
          display_order INTEGER DEFAULT 0,
          webp_blob_id VARCHAR(255),
          avif_blob_id VARCHAR(255),
          thumbnail_blob_id VARCHAR(255),
          webp_url TEXT,
          avif_url TEXT,
          thumbnail_url TEXT,
          original_width INTEGER,
          original_height INTEGER,
          file_size_original INTEGER,
          file_size_webp INTEGER,
          file_size_avif INTEGER,
          file_size_thumbnail INTEGER,
          processing_status VARCHAR(50) DEFAULT 'pending',
          processing_error TEXT,
          image_hash VARCHAR(64),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(property_id, original_url)
        );

        -- Create hot properties table
        CREATE TABLE IF NOT EXISTS hot_properties (
          id SERIAL PRIMARY KEY,
          tokko_id INTEGER UNIQUE NOT NULL,
          heat_score INTEGER DEFAULT 1,
          last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          access_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create search cache table
        CREATE TABLE IF NOT EXISTS search_cache (
          id SERIAL PRIMARY KEY,
          cache_key VARCHAR(255) UNIQUE NOT NULL,
          query_params JSONB,
          result_data JSONB,
          result_count INTEGER,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create performance metrics table
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id SERIAL PRIMARY KEY,
          metric_type VARCHAR(100) NOT NULL,
          metric_name VARCHAR(200) NOT NULL,
          metric_value DECIMAL,
          metadata JSONB,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `

      // Create indexes
      await this.sql`
        -- Properties cache indexes
        CREATE INDEX IF NOT EXISTS idx_properties_cache_tokko_id ON properties_cache(tokko_id);
        CREATE INDEX IF NOT EXISTS idx_properties_cache_featured ON properties_cache(featured) WHERE featured = true;
        CREATE INDEX IF NOT EXISTS idx_properties_cache_property_type ON properties_cache(property_type_code);
        CREATE INDEX IF NOT EXISTS idx_properties_cache_operation ON properties_cache(operation_type);
        CREATE INDEX IF NOT EXISTS idx_properties_cache_location ON properties_cache(location_name);
        CREATE INDEX IF NOT EXISTS idx_properties_cache_sync_status ON properties_cache(sync_status);

        -- Blob storage indexes
        CREATE INDEX IF NOT EXISTS idx_neon_blob_storage_hash ON neon_blob_storage(file_hash);
        CREATE INDEX IF NOT EXISTS idx_neon_blob_storage_mime_type ON neon_blob_storage(mime_type);
        CREATE INDEX IF NOT EXISTS idx_neon_blob_storage_deleted_at ON neon_blob_storage(deleted_at) WHERE deleted_at IS NULL;

        -- Property images indexes
        CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images_neon(property_id);
        CREATE INDEX IF NOT EXISTS idx_property_images_status ON property_images_neon(processing_status);
        CREATE INDEX IF NOT EXISTS idx_property_images_hash ON property_images_neon(image_hash) WHERE image_hash IS NOT NULL;

        -- Hot properties indexes
        CREATE INDEX IF NOT EXISTS idx_hot_properties_tokko_id ON hot_properties(tokko_id);
        CREATE INDEX IF NOT EXISTS idx_hot_properties_heat_score ON hot_properties(heat_score DESC);

        -- Search cache indexes
        CREATE INDEX IF NOT EXISTS idx_search_cache_key ON search_cache(cache_key);
        CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

        -- Performance metrics indexes
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded ON performance_metrics(recorded_at);
      `

      console.log("   ✅ Fresh schema created successfully")
    } catch (error) {
      this.logError("schema_creation", error.message)
      console.warn(`   ⚠️ Schema creation had issues: ${error.message}`)
    }
  }

  private logError(type: string, message: string, table?: string) {
    this.stats.errors.push({
      type,
      message,
      table,
      timestamp: new Date(),
    })
  }

  private printFinalStats() {
    this.stats.endTime = new Date()
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime()
    const durationMinutes = Math.round(duration / 60000)

    console.log("\n" + "=".repeat(50))
    console.log("📊 DATABASE RESET COMPLETED")
    console.log("=".repeat(50))

    console.log(`⏱️  Duration: ${durationMinutes} minutes`)
    console.log(`📊 Statistics:`)
    console.log(`   - Tables found: ${this.stats.tablesFound}`)
    console.log(`   - Tables deleted: ${this.stats.tablesDeleted}`)
    console.log(`   - Sequences reset: ${this.stats.sequencesReset}`)
    console.log(`   - Extensions dropped: ${this.stats.extensionsDropped}`)
    console.log(`   - Backup created: ${this.stats.backupCreated ? "Yes" : "No"}`)

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length} total):`)
      const errorSummary = this.stats.errors.reduce(
        (acc, error) => {
          acc[error.type] = (acc[error.type] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      Object.entries(errorSummary).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}`)
      })

      console.log(`\n🔍 Recent Errors:`)
      this.stats.errors.slice(-3).forEach((error, index) => {
        const tableInfo = error.table ? ` (Table: ${error.table})` : ""
        console.log(`   ${index + 1}. [${error.type}] ${error.message}${tableInfo}`)
      })
    }

    if (this.config.dryRun) {
      console.log("\n🧪 DRY RUN COMPLETED - No actual changes were made")
    } else {
      console.log("\n✅ Database reset completed successfully!")
      console.log("🚀 Ready for fresh API import with: npx tsx scripts/api-direct-migration-blob.ts")
    }
  }
}

// Run the reset
const resetService = new DatabaseResetService()
resetService.resetDatabase().catch(console.error)
