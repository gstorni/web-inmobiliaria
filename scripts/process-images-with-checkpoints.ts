import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function processImagesWithCheckpoints() {
  console.log("🖼️ Starting image processing with checkpointing...")

  try {
    // Dynamic import to ensure environment variables are loaded
    const { imageOptimizationService } = await import("../lib/image-optimization-service")

    const result = await imageOptimizationService.processImagesWithCheckpoint(50) // Large batch size

    console.log(`✅ Image processing completed successfully!`)
    console.log(`📊 Results:`)
    console.log(`   - Processed: ${result.processed} images`)
    console.log(`   - Errors: ${result.errors} images`)
    console.log(`   - Process ID: ${result.processId}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Image processing failed:", error)
    process.exit(1)
  }
}

processImagesWithCheckpoints()
