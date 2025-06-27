import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function diagnoseStuckSync() {
  console.log("🔍 DIAGNOSING STUCK SYNC PROCESS")
  console.log("============================================================")

  try {
    // Import services
    const { supabaseAdmin } = await import("../lib/supabase-client")
    const { checkpointService } = await import("../lib/checkpoint-service")

    console.log("\n📊 STEP 1: Check Active Checkpoints")
    console.log("----------------------------------------")

    const activeCheckpoints = await checkpointService.getActiveCheckpoints()
    console.log(`Found ${activeCheckpoints.length} active checkpoints:`)

    for (const checkpoint of activeCheckpoints) {
      console.log(`\n🔄 Process: ${checkpoint.processType}/${checkpoint.processId}`)
      console.log(`   Status: ${checkpoint.status}`)
      console.log(`   Progress: ${checkpoint.processedItems}/${checkpoint.totalItems}`)
      console.log(`   Current Batch: ${checkpoint.currentBatch}`)
      console.log(`   Started: ${checkpoint.startedAt}`)
      console.log(`   Last Updated: ${checkpoint.updatedAt}`)

      // Calculate how long it's been stuck
      const lastUpdate = new Date(checkpoint.updatedAt)
      const now = new Date()
      const stuckTime = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000 / 60) // minutes
      console.log(`   ⏱️ Stuck for: ${stuckTime} minutes`)

      if (stuckTime > 5) {
        console.log(`   ⚠️ This process appears to be stuck!`)

        // Mark as failed and clean up
        console.log(`   🧹 Marking as failed and cleaning up...`)
        await checkpointService.completeCheckpoint(checkpoint.processType, checkpoint.processId, "failed")
        console.log(`   ✅ Cleaned up stuck process`)
      }
    }

    console.log("\n🧪 STEP 2: Test TokkoBroker API")
    console.log("----------------------------------------")

    try {
      const { secureTokkoClient } = await import("../lib/enhanced-tokko-client")
      console.log("🔄 Testing TokkoBroker connection...")

      const testResponse = await Promise.race([
        secureTokkoClient.getProperties({ limit: "1", offset: "0" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000)),
      ])

      console.log("✅ TokkoBroker API is working")
      console.log(`   Total properties available: ${testResponse.meta?.total_count || "Unknown"}`)
    } catch (error) {
      console.log("❌ TokkoBroker API failed:", error)
    }

    console.log("\n💾 STEP 3: Test Supabase Performance")
    console.log("----------------------------------------")

    try {
      console.log("🔄 Testing Supabase write performance...")

      const testStart = Date.now()
      const testRecord = {
        process_type: "diagnostic_test",
        process_id: `test_${Date.now()}`,
        status: "completed" as const,
        total_items: 1,
        processed_items: 1,
        failed_items: 0,
        current_batch: 1,
        checkpoint_data: { test: true },
        error_log: [],
        completed_at: new Date().toISOString(),
      }

      const { error } = await supabaseAdmin.from("processing_checkpoints").insert(testRecord)

      if (error) {
        console.log("❌ Supabase write failed:", error)
      } else {
        const testEnd = Date.now()
        console.log(`✅ Supabase write successful (${testEnd - testStart}ms)`)

        // Clean up test record
        await supabaseAdmin
          .from("processing_checkpoints")
          .delete()
          .eq("process_type", "diagnostic_test")
          .eq("process_id", testRecord.process_id)
      }
    } catch (error) {
      console.log("❌ Supabase test failed:", error)
    }

    console.log("\n🔧 STEP 4: Recommendations")
    console.log("----------------------------------------")

    if (activeCheckpoints.length === 0) {
      console.log("✅ No stuck processes found. You can start a new sync.")
    } else {
      console.log("🧹 Cleaned up stuck processes. You can now start a fresh sync.")
    }

    console.log("\n💡 To start a fresh sync:")
    console.log("   1. Go to /cache-dashboard")
    console.log("   2. Click 'Start New Sync'")
    console.log("   3. Use a smaller limit (like 50) to test")

    console.log("\n✅ Diagnosis complete!")
  } catch (error) {
    console.error("❌ Diagnosis failed:", error)
  }
}

diagnoseStuckSync()
