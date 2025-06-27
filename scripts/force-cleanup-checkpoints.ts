import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") })

async function forceCleanupCheckpoints() {
  console.log("🧹 FORCE CLEANUP STUCK CHECKPOINTS")
  console.log("============================================================")

  try {
    const { supabaseAdmin } = await import("../lib/supabase-client")

    console.log("🔄 Finding all active/stuck checkpoints...")

    // Get all running or paused checkpoints
    const { data: stuckCheckpoints, error } = await supabaseAdmin
      .from("processing_checkpoints")
      .select("*")
      .in("status", ["running", "paused"])

    if (error) {
      throw new Error(`Failed to get checkpoints: ${error.message}`)
    }

    console.log(`Found ${stuckCheckpoints?.length || 0} potentially stuck checkpoints`)

    if (!stuckCheckpoints || stuckCheckpoints.length === 0) {
      console.log("✅ No stuck checkpoints found!")
      return
    }

    // Mark all as failed
    for (const checkpoint of stuckCheckpoints) {
      console.log(`🧹 Cleaning up: ${checkpoint.process_type}/${checkpoint.process_id}`)

      const { error: updateError } = await supabaseAdmin
        .from("processing_checkpoints")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", checkpoint.id)

      if (updateError) {
        console.log(`❌ Failed to cleanup ${checkpoint.process_id}:`, updateError)
      } else {
        console.log(`✅ Cleaned up ${checkpoint.process_id}`)
      }
    }

    console.log("\n✅ All stuck checkpoints have been cleaned up!")
    console.log("You can now start fresh sync processes.")
  } catch (error) {
    console.error("❌ Cleanup failed:", error)
  }
}

forceCleanupCheckpoints()
