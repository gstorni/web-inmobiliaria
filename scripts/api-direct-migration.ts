#!/usr/bin/env npx tsx

import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables first
config({ path: resolve(process.cwd(), ".env.local") })

console.log("🚀 DIRECT API MIGRATION TO NEON WITH BLOB STORAGE")
console.log("=".repeat(60))

interface MigrationStats {
  totalProperties: number
  processedProperties: number
  successfulProperties: number
  failedProperties: number
  skippedProperties: number
  totalImages: number
  processedImages: number
  successfulImages: number
  failedImages: number
  blobStorageStats: {
    totalBlobs: number
    totalBlobSize: number
    deduplicatedBlobs: number
    spaceSaved: number
  }
  startTime: Date
  endTime?: Date
  errors: Array<{
    type: string
    message: string
    propertyId?: number
    imageIndex?: number
    timestamp: Date
    context?: any
  }>
}

interface MigrationConfig {
  batchSize: number
  maxConcurrency: number
  retryAttempts: number
  retryDelay: number
  imageProcessing: boolean
  updateExisting: boolean
  skipExisting: boolean
  apiRateLimit: number
  blobStorage: {
    enabled: boolean
    maxFileSize: number
    compressionLevel: number
    deduplication: boolean
  }
}

class DirectApiMigrationWithBlob {
  private stats: MigrationStats
  private config: MigrationConfig
  private tokkoClient: any
  private neonSql: any
  private blobStorage: any
  private imageService: any
  private rateLimiter: Map<string, number> = new Map()
  private processedHashes: Set<string> = new Set() // For deduplication tracking

  constructor() {
    this.stats = {
      totalProperties: 0,
      processedProperties: 0,
      successfulProperties: 0,
      failedProperties: 0,
      skippedProperties: 0,
      totalImages: 0,
      processedImages: 0,
      successfulImages: 0,
      failedImages: 0,
      blobStorageStats: {
        totalBlobs: 0,
        totalBlobSize: 0,
        deduplicatedBlobs: 0,
        spaceSaved: 0,
      },
      startTime: new Date(),
      errors: [],
    }

    this.config = {
      batchSize: Number.parseInt(process.env.MIGRATION_BATCH_SIZE || "15"),
      maxConcurrency: Number.parseInt(process.env.MIGRATION_MAX_CONCURRENCY || "3"),
      retryAttempts: Number.parseInt(process.env.MIGRATION_RETRY_ATTEMPTS || "3"),
      retryDelay: Number.parseInt(process.env.MIGRATION_RETRY_DELAY || "1000"),
      imageProcessing: process.env.MIGRATION_PROCESS_IMAGES !== "false",
      updateExisting: process.env.MIGRATION_UPDATE_EXISTING === "true",
      skipExisting: process.env.MIGRATION_SKIP_EXISTING !== "false",
      apiRateLimit: Number.parseInt(process.env.MIGRATION_API_RATE_LIMIT || "8"),
      blobStorage: {
        enabled: process.env.MIGRATION_BLOB_STORAGE !== "false",
        maxFileSize: Number.parseInt(process.env.MIGRATION_MAX_FILE_SIZE || "10485760"), // 10MB
        compressionLevel: Number.parseInt(process.env.MIGRATION_COMPRESSION_LEVEL || "6"),
        deduplication: process.env.MIGRATION_DEDUPLICATION !== "false",
      },
    }
  }

  async initialize() {
    try {
      console.log("🔧 Initializing migration services...")

      // Initialize Neon connection
      const { sql } = await import("../lib/neon-client-fixed")
      this.neonSql = sql

      // Initialize Tokko client
      const { secureTokkoClient } = await import("../lib/enhanced-tokko-client")
      this.tokkoClient = secureTokkoClient

      // Initialize blob storage
      if (this.config.blobStorage.enabled) {
        const { neonBlobStorage } = await import("../lib/neon-blob-storage")
        this.blobStorage = neonBlobStorage
        console.log("✅ Blob storage initialized")
      }

      // Initialize image service with blob storage
      if (this.config.imageProcessing) {
        const { neonImageOptimizationBlob } = await import("../lib/neon-image-optimization-blob")
        this.imageService = neonImageOptimizationBlob
        console.log("✅ Image optimization with blob storage initialized")
      }

      console.log("✅ Services initialized successfully")
      console.log(`📊 Configuration:`)
      console.log(`   - Batch size: ${this.config.batchSize}`)
      console.log(`   - Max concurrency: ${this.config.maxConcurrency}`)
      console.log(`   - Retry attempts: ${this.config.retryAttempts}`)
      console.log(`   - Image processing: ${this.config.imageProcessing ? "enabled" : "disabled"}`)
      console.log(`   - Blob storage: ${this.config.blobStorage.enabled ? "enabled" : "disabled"}`)
      console.log(`   - Deduplication: ${this.config.blobStorage.deduplication ? "enabled" : "disabled"}`)
      console.log(`   - Update existing: ${this.config.updateExisting ? "yes" : "no"}`)
      console.log(`   - Skip existing: ${this.config.skipExisting ? "yes" : "no"}`)
    } catch (error) {
      this.logError("initialization", error.message)
      throw error
    }
  }

  async migrate() {
    try {
      await this.initialize()

      console.log("\n📋 Step 1: Fetching property list from API...")
      const propertyIds = await this.fetchPropertyIds()

      console.log(`\n📋 Step 2: Processing ${propertyIds.length} properties with blob storage...`)
      await this.processPropertiesInBatches(propertyIds)

      console.log("\n📋 Step 3: Finalizing migration and blob storage...")
      await this.finalizeMigration()

      console.log("\n📋 Step 4: Generating storage statistics...")
      await this.generateStorageStats()

      this.printFinalStats()
    } catch (error) {
      this.logError("migration", error.message)
      console.error("\n❌ MIGRATION FAILED:", error)
      process.exit(1)
    }
  }

  private async fetchPropertyIds(): Promise<number[]> {
    const propertyIds: number[] = []
    let offset = 0
    const limit = 100

    while (true) {
      try {
        await this.respectRateLimit("api")

        console.log(`   Fetching properties batch (offset: ${offset})...`)

        const response = await this.tokkoClient.getProperties({
          limit,
          offset,
        })

        if (!response.objects || response.objects.length === 0) {
          break
        }

        const batchIds = response.objects.map((p: any) => p.id)
        propertyIds.push(...batchIds)

        console.log(`   Found ${batchIds.length} properties (total: ${propertyIds.length})`)

        offset += limit

        if (response.meta?.total_count && propertyIds.length >= response.meta.total_count) {
          break
        }
      } catch (error) {
        this.logError("fetch_property_ids", error.message)

        if (offset === 0) {
          throw new Error("Failed to fetch initial property list")
        }

        console.warn(`⚠️ Failed to fetch batch at offset ${offset}, continuing with ${propertyIds.length} properties`)
        break
      }
    }

    this.stats.totalProperties = propertyIds.length
    console.log(`✅ Found ${propertyIds.length} total properties`)

    return propertyIds
  }

  private async processPropertiesInBatches(propertyIds: number[]) {
    const batches = this.createBatches(propertyIds, this.config.batchSize)

    console.log(`📦 Processing ${batches.length} batches of ${this.config.batchSize} properties each`)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchNumber = i + 1

      console.log(`\n🔄 Processing batch ${batchNumber}/${batches.length} (${batch.length} properties)...`)

      try {
        await this.processBatch(batch, batchNumber)
      } catch (error) {
        this.logError("batch_processing", error.message, undefined, undefined, { batchNumber, batchSize: batch.length })
        console.warn(`⚠️ Batch ${batchNumber} failed, continuing with next batch`)
      }

      // Progress update with blob storage stats
      const progress = ((batchNumber / batches.length) * 100).toFixed(1)
      console.log(`📊 Progress: ${progress}% (${this.stats.processedProperties}/${this.stats.totalProperties})`)
      console.log(
        `💾 Blob Storage: ${this.stats.blobStorageStats.totalBlobs} blobs, ${this.formatBytes(this.stats.blobStorageStats.totalBlobSize)}`,
      )

      // Rate limiting between batches
      if (batchNumber < batches.length) {
        await this.sleep(800) // Slightly longer delay for blob operations
      }
    }
  }

  private async processBatch(propertyIds: number[], batchNumber: number) {
    const semaphore = new Semaphore(this.config.maxConcurrency)
    const promises = propertyIds.map((propertyId) =>
      semaphore.acquire(() => this.processProperty(propertyId, batchNumber)),
    )

    await Promise.allSettled(promises)
  }

  private async processProperty(propertyId: number, batchNumber: number): Promise<void> {
    const startTime = Date.now()

    try {
      // Check if property already exists
      if (this.config.skipExisting || this.config.updateExisting) {
        const exists = await this.checkPropertyExists(propertyId)
        if (exists && this.config.skipExisting && !this.config.updateExisting) {
          console.log(`   ⏭️ Skipping existing property ${propertyId}`)
          this.stats.skippedProperties++
          this.stats.processedProperties++
          return
        }
      }

      // Fetch property details with retry
      const propertyData = await this.fetchPropertyWithRetry(propertyId)
      if (!propertyData) {
        throw new Error("Failed to fetch property data")
      }

      // Transform and save property
      const transformedProperty = await this.transformProperty(propertyData)
      await this.saveProperty(transformedProperty, this.config.updateExisting)

      // Process images with blob storage if enabled
      if (this.config.imageProcessing && propertyData.photos?.length > 0) {
        await this.processPropertyImagesWithBlob(propertyId, propertyData.photos)
      }

      this.stats.successfulProperties++
      const processingTime = Date.now() - startTime

      console.log(`   ✅ Property ${propertyId} processed successfully (${processingTime}ms)`)
    } catch (error) {
      this.stats.failedProperties++
      this.logError("property_processing", error.message, propertyId)
      console.warn(`   ❌ Failed to process property ${propertyId}: ${error.message}`)
    } finally {
      this.stats.processedProperties++
    }
  }

  private async processPropertyImagesWithBlob(propertyId: number, photos: any[]): Promise<void> {
    if (!this.imageService || !photos?.length) return

    try {
      this.stats.totalImages += photos.length

      console.log(`   🖼️ Processing ${photos.length} images for property ${propertyId}...`)

      // Process images with enhanced blob storage
      const imageResults = await this.processImagesInParallel(propertyId, photos)

      // Update statistics
      for (const result of imageResults) {
        if (result.success) {
          this.stats.successfulImages++
          this.stats.blobStorageStats.totalBlobs += result.blobCount || 0
          this.stats.blobStorageStats.totalBlobSize += result.totalSize || 0

          if (result.deduplicated) {
            this.stats.blobStorageStats.deduplicatedBlobs++
            this.stats.blobStorageStats.spaceSaved += result.spaceSaved || 0
          }
        } else {
          this.stats.failedImages++
          this.logError("image_processing", result.error, propertyId, result.imageIndex)
        }
        this.stats.processedImages++
      }

      const successCount = imageResults.filter((r) => r.success).length
      const failCount = imageResults.filter((r) => !r.success).length

      if (failCount > 0) {
        console.warn(`   ⚠️ ${failCount}/${photos.length} images failed for property ${propertyId}`)
      } else {
        console.log(`   ✅ All ${successCount} images processed successfully for property ${propertyId}`)
      }
    } catch (error) {
      this.logError("image_batch_processing", error.message, propertyId)
      this.stats.failedImages += photos.length
      console.error(`   ❌ Failed to process image batch for property ${propertyId}: ${error.message}`)
    }
  }

  private async processImagesInParallel(propertyId: number, photos: any[]): Promise<any[]> {
    const semaphore = new Semaphore(2) // Limit concurrent image processing
    const promises = photos.map((photo, index) =>
      semaphore.acquire(() => this.processSingleImageWithBlob(propertyId, photo, index)),
    )

    return Promise.allSettled(promises).then((results) =>
      results.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value
        } else {
          return {
            success: false,
            error: result.reason?.message || "Unknown error",
            imageIndex: index,
            originalUrl: photos[index]?.image,
          }
        }
      }),
    )
  }

  private async processSingleImageWithBlob(propertyId: number, photo: any, imageIndex: number): Promise<any> {
    const imageStartTime = Date.now()

    try {
      // Download original image
      const originalBuffer = await this.downloadImageWithRetry(photo.image)
      const originalSize = originalBuffer.length

      // Validate image
      if (originalSize > this.config.blobStorage.maxFileSize) {
        throw new Error(
          `Image too large: ${this.formatBytes(originalSize)} > ${this.formatBytes(this.config.blobStorage.maxFileSize)}`,
        )
      }

      // Process image with blob storage
      const result = await this.imageService.processImage(
        propertyId,
        {
          original_url: photo.image,
          description: photo.description || "",
          display_order: imageIndex,
          buffer: originalBuffer,
        },
        imageIndex,
      )

      const processingTime = Date.now() - imageStartTime

      return {
        success: true,
        imageIndex,
        originalUrl: photo.image,
        processingTime,
        blobCount: 3, // webp, avif, thumbnail
        totalSize: result.sizes?.webp + result.sizes?.avif + result.sizes?.thumbnail || 0,
        deduplicated: result.deduplicated || false,
        spaceSaved: result.spaceSaved || 0,
        urls: result.urls,
      }
    } catch (error) {
      const processingTime = Date.now() - imageStartTime

      console.warn(`   ⚠️ Image ${imageIndex} failed for property ${propertyId}: ${error.message} (${processingTime}ms)`)

      return {
        success: false,
        error: error.message,
        imageIndex,
        originalUrl: photo.image,
        processingTime,
      }
    }
  }

  private async downloadImageWithRetry(url: string, maxRetries = 3): Promise<Buffer> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.respectRateLimit("image_download")

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; PropertyImageOptimizer/1.0)",
            Accept: "image/*",
          },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const contentType = response.headers.get("content-type")
        if (!contentType?.startsWith("image/")) {
          throw new Error(`Invalid content type: ${contentType}`)
        }

        return Buffer.from(await response.arrayBuffer())
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`Failed to download image after ${maxRetries} attempts: ${error.message}`)
        }

        // Exponential backoff
        await this.sleep(1000 * Math.pow(2, attempt - 1))
      }
    }

    throw new Error("Download failed")
  }

  private async fetchPropertyWithRetry(propertyId: number): Promise<any> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this.respectRateLimit("api")

        const property = await this.tokkoClient.getProperty(propertyId)
        return property
      } catch (error) {
        lastError = error
        console.warn(
          `   ⚠️ Attempt ${attempt}/${this.config.retryAttempts} failed for property ${propertyId}: ${error.message}`,
        )

        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelay * attempt
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error("All retry attempts failed")
  }

  private async transformProperty(tokkoProperty: any): Promise<any> {
    const { transformTokkoProperty } = await import("../lib/tokko-transformer")
    return transformTokkoProperty(tokkoProperty)
  }

  private async saveProperty(property: any, updateExisting: boolean): Promise<void> {
    try {
      if (updateExisting) {
        await this.neonSql`
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
            sync_status, last_synced_at
          ) VALUES (
            ${property.id}, ${property.title}, ${property.description}, ${property.richDescription}, ${property.referenceCode},
            ${JSON.stringify(property.mainPrice)}, ${JSON.stringify(property.prices)}, ${property.availableOperations},
            ${property.surface}, ${property.coveredSurface}, ${property.uncoveredSurface}, ${property.totalSurface},
            ${property.location.name}, ${property.location.fullLocation}, ${property.location.shortLocation}, 
            ${property.location.address}, ${property.location.realAddress},
            ${JSON.stringify(property.location.coordinates)}, ${property.type}, ${property.typeCode}, ${property.operation},
            ${property.age}, ${property.condition}, ${property.situation}, ${property.zonification},
            ${property.rooms}, ${property.bathrooms}, ${property.toilets}, ${property.suites}, 
            ${property.parkingSpaces}, ${property.floors}, ${property.features.orientation},
            ${property.features.amenities}, ${property.features.amenities}, ${JSON.stringify(property.features.extraAttributes)}, 
            ${JSON.stringify(property.contact)},
            ${property.featured}, ${property.status}, ${property.transactionRequirements}, ${property.hasTemporaryRent},
            ${property.expenses}, ${property.publicUrl}, ${property.createdAt}, ${property.createdAt},
            'synced', NOW()
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
            sync_status = 'synced',
            last_synced_at = NOW(),
            updated_at = NOW()
        `
      } else {
        await this.neonSql`
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
            sync_status, last_synced_at
          ) VALUES (
            ${property.id}, ${property.title}, ${property.description}, ${property.richDescription}, ${property.referenceCode},
            ${JSON.stringify(property.mainPrice)}, ${JSON.stringify(property.prices)}, ${property.availableOperations},
            ${property.surface}, ${property.coveredSurface}, ${property.uncoveredSurface}, ${property.totalSurface},
            ${property.location.name}, ${property.location.fullLocation}, ${property.location.shortLocation}, 
            ${property.location.address}, ${property.location.realAddress},
            ${JSON.stringify(property.location.coordinates)}, ${property.type}, ${property.typeCode}, ${property.operation},
            ${property.age}, ${property.condition}, ${property.situation}, ${property.zonification},
            ${property.rooms}, ${property.bathrooms}, ${property.toilets}, ${property.suites}, 
            ${property.parkingSpaces}, ${property.floors}, ${property.features.orientation},
            ${property.features.amenities}, ${property.features.amenities}, ${JSON.stringify(property.features.extraAttributes)}, 
            ${JSON.stringify(property.contact)},
            ${property.featured}, ${property.status}, ${property.transactionRequirements}, ${property.hasTemporaryRent},
            ${property.expenses}, ${property.publicUrl}, ${property.createdAt}, ${property.createdAt},
            'synced', NOW()
          )
        `
      }
    } catch (error) {
      throw new Error(`Failed to save property: ${error.message}`)
    }
  }

  private async checkPropertyExists(propertyId: number): Promise<boolean> {
    try {
      const result = await this.neonSql`
        SELECT 1 FROM properties_cache WHERE tokko_id = ${propertyId} LIMIT 1
      `
      return result.length > 0
    } catch (error) {
      return false
    }
  }

  private async respectRateLimit(type: string): Promise<void> {
    const now = Date.now()
    const lastCall = this.rateLimiter.get(type) || 0
    const minInterval = type === "image_download" ? 200 : 1000 / this.config.apiRateLimit

    const timeSinceLastCall = now - lastCall
    if (timeSinceLastCall < minInterval) {
      const waitTime = minInterval - timeSinceLastCall
      await this.sleep(waitTime)
    }

    this.rateLimiter.set(type, Date.now())
  }

  private async finalizeMigration(): Promise<void> {
    try {
      // Update hot properties tracking
      await this.neonSql`
        INSERT INTO hot_properties (tokko_id, heat_score, last_accessed_at)
        SELECT tokko_id, 1, NOW()
        FROM properties_cache
        WHERE featured = true
        ON CONFLICT (tokko_id) DO UPDATE SET
          heat_score = GREATEST(hot_properties.heat_score, 1),
          last_accessed_at = NOW()
      `

      // Clean up old search cache
      await this.neonSql`DELETE FROM search_cache WHERE expires_at < NOW()`

      console.log("✅ Migration finalization completed")
    } catch (error) {
      this.logError("finalization", error.message)
      console.warn("⚠️ Migration finalization had issues, but data migration completed")
    }
  }

  private async generateStorageStats(): Promise<void> {
    try {
      if (this.blobStorage) {
        const stats = await this.blobStorage.getStorageStats()

        console.log("📊 Blob Storage Statistics:")
        console.log(`   - Total files: ${stats.totalFiles}`)
        console.log(`   - Total size: ${this.formatBytes(stats.totalSize)}`)
        console.log(`   - Average file size: ${this.formatBytes(stats.averageFileSize)}`)
        console.log(`   - Storage by type:`)

        stats.storageByMimeType.forEach((type: any) => {
          console.log(`     • ${type.mime_type}: ${type.file_count} files (${this.formatBytes(type.total_size)})`)
        })
      }
    } catch (error) {
      console.warn("⚠️ Failed to generate storage statistics:", error.message)
    }
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize))
    }
    return batches
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private logError(type: string, message: string, propertyId?: number, imageIndex?: number, context?: any): void {
    this.stats.errors.push({
      type,
      message,
      propertyId,
      imageIndex,
      timestamp: new Date(),
      context,
    })
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  private printFinalStats(): void {
    this.stats.endTime = new Date()
    const duration = this.stats.endTime.getTime() - this.stats.startTime.getTime()
    const durationMinutes = Math.round(duration / 60000)

    console.log("\n" + "=".repeat(60))
    console.log("📊 MIGRATION WITH BLOB STORAGE COMPLETED")
    console.log("=".repeat(60))

    console.log(`⏱️  Duration: ${durationMinutes} minutes`)
    console.log(`📦 Properties:`)
    console.log(`   - Total: ${this.stats.totalProperties}`)
    console.log(`   - Processed: ${this.stats.processedProperties}`)
    console.log(`   - Successful: ${this.stats.successfulProperties}`)
    console.log(`   - Failed: ${this.stats.failedProperties}`)
    console.log(`   - Skipped: ${this.stats.skippedProperties}`)

    if (this.config.imageProcessing) {
      console.log(`🖼️  Images:`)
      console.log(`   - Total: ${this.stats.totalImages}`)
      console.log(`   - Processed: ${this.stats.processedImages}`)
      console.log(`   - Successful: ${this.stats.successfulImages}`)
      console.log(`   - Failed: ${this.stats.failedImages}`)
    }

    if (this.config.blobStorage.enabled) {
      console.log(`💾 Blob Storage:`)
      console.log(`   - Total blobs: ${this.stats.blobStorageStats.totalBlobs}`)
      console.log(`   - Total size: ${this.formatBytes(this.stats.blobStorageStats.totalBlobSize)}`)
      console.log(`   - Deduplicated: ${this.stats.blobStorageStats.deduplicatedBlobs}`)
      console.log(`   - Space saved: ${this.formatBytes(this.stats.blobStorageStats.spaceSaved)}`)
    }

    const successRate =
      this.stats.totalProperties > 0 ? (this.stats.successfulProperties / this.stats.totalProperties) * 100 : 0
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`)

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

      // Show recent errors
      console.log(`\n🔍 Recent Errors:`)
      this.stats.errors.slice(-5).forEach((error, index) => {
        const propertyInfo = error.propertyId ? ` (Property: ${error.propertyId})` : ""
        const imageInfo = error.imageIndex !== undefined ? ` (Image: ${error.imageIndex})` : ""
        console.log(`   ${index + 1}. [${error.type}] ${error.message}${propertyInfo}${imageInfo}`)
      })
    }

    console.log("\n✅ Migration with blob storage completed successfully!")
    console.log("🔗 Images are now served from: /api/files/[fileId]/[filename]")
  }
}

// Semaphore for concurrency control
class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--
        this.executeTask(task, resolve, reject)
      } else {
        this.waiting.push(() => {
          this.permits--
          this.executeTask(task, resolve, reject)
        })
      }
    })
  }

  private async executeTask<T>(task: () => Promise<T>, resolve: (value: T) => void, reject: (error: any) => void) {
    try {
      const result = await task()
      resolve(result)
    } catch (error) {
      reject(error)
    } finally {
      this.permits++
      if (this.waiting.length > 0) {
        const next = this.waiting.shift()
        if (next) next()
      }
    }
  }
}

// Run migration
const migration = new DirectApiMigrationWithBlob()
migration.migrate().catch(console.error)
