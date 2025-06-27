import { dataFlowAnalyzer } from "./analyze-data-flow"
import { imageProcessingDiagnostic } from "./diagnose-image-processing"
import { enhancedMultiTierCache } from "@/lib/enhanced-multi-tier-cache"
import { sql } from "@/lib/neon-client"

export class DataFlowFixer {
  async fixAllIssues(): Promise<void> {
    console.log(`🔧 Starting comprehensive data flow fix...`)

    // Step 1: Analyze current state
    console.log(`\n📊 Step 1: Analyzing current state...`)
    await dataFlowAnalyzer.runComprehensiveAnalysis()

    // Step 2: Fix missing properties in Neon
    console.log(`\n💾 Step 2: Syncing missing properties...`)
    await this.syncMissingProperties()

    // Step 3: Fix image processing
    console.log(`\n🖼️ Step 3: Fixing image processing...`)
    await this.fixImageProcessing()

    // Step 4: Warm Redis cache
    console.log(`\n🔴 Step 4: Warming Redis cache...`)
    await this.warmRedisCache()

    // Step 5: Verify fixes
    console.log(`\n✅ Step 5: Verifying fixes...`)
    await this.verifyFixes()

    console.log(`\n🎉 Data flow fix completed!`)
  }

  private async syncMissingProperties(): Promise<void> {
    try {
      // Find properties that exist in API but not in Neon
      const result = await enhancedMultiTierCache.syncProperties({
        mode: "incremental",
        limit: 100,
      })

      console.log(`✅ Synced ${result.synced} properties (${result.errors} errors)`)
    } catch (error: any) {
      console.error(`❌ Property sync error:`, error.message)
    }
  }

  private async fixImageProcessing(): Promise<void> {
    try {
      // Find properties with missing or failed images
      const propertiesWithImageIssues = await sql`
        SELECT DISTINCT pc.tokko_id
        FROM properties_cache pc
        LEFT JOIN property_images_neon pin ON pc.tokko_id = pin.property_id
        WHERE pin.property_id IS NULL 
           OR pin.processing_status IN ('pending', 'error')
        LIMIT 20
      `

      console.log(`🔧 Fixing images for ${propertiesWithImageIssues.length} properties...`)

      for (const property of propertiesWithImageIssues) {
        const result = await imageProcessingDiagnostic.fixImageProcessing(property.tokko_id)
        console.log(`Property ${property.tokko_id}: ${result.message}`)
      }
    } catch (error: any) {
      console.error(`❌ Image processing fix error:`, error.message)
    }
  }

  private async warmRedisCache(): Promise<void> {
    try {
      const result = await enhancedMultiTierCache.warmCache()
      console.log(`✅ ${result.message}`)
    } catch (error: any) {
      console.error(`❌ Redis warming error:`, error.message)
    }
  }

  private async verifyFixes(): Promise<void> {
    try {
      // Test a few properties to verify everything works
      const testProperties = await sql`
        SELECT tokko_id FROM properties_cache 
        ORDER BY updated_at DESC 
        LIMIT 3
      `

      for (const property of testProperties) {
        const analysis = await dataFlowAnalyzer.analyzeProperty(property.tokko_id)

        console.log(`\n🧪 Testing Property ${property.tokko_id}:`)
        console.log(`   Redis: ${analysis.dataFlow.redis.available ? "✅" : "❌"}`)
        console.log(`   Neon: ${analysis.dataFlow.neon.available ? "✅" : "❌"}`)
        console.log(`   API: ${analysis.dataFlow.api.available ? "✅" : "❌"}`)
        console.log(`   Images: ${analysis.imageFlow.processedImages}/${analysis.imageFlow.originalImages}`)
      }
    } catch (error: any) {
      console.error(`❌ Verification error:`, error.message)
    }
  }
}

export const dataFlowFixer = new DataFlowFixer()

// Run fix if called directly
if (require.main === module) {
  dataFlowFixer
    .fixAllIssues()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Fix failed:", error)
      process.exit(1)
    })
}
