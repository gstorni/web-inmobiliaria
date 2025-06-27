import { NextResponse } from "next/server"
import { checkpointService } from "@/lib/checkpoint-service"

export const revalidate = 0 // Ensure dynamic fetching

export async function GET() {
  try {
    console.log("🔍 Fetching active checkpoints...")

    // Since we've removed Supabase, we'll use Neon directly
    console.log("🔗 Using Neon database for checkpoints...")

    try {
      const activeProcesses = await checkpointService.getActiveCheckpoints()
      const processesWithProgress = activeProcesses.map((p) => ({
        ...p,
        progressInfo: checkpointService.getProgressInfo(p),
      }))

      console.log(`✅ Successfully queried checkpoints. Found ${activeProcesses?.length || 0} active checkpoints`)

      return NextResponse.json({
        success: true,
        activeProcesses: processesWithProgress,
        timestamp: new Date().toISOString(),
      })
    } catch (dbError: any) {
      console.error("❌ Database connection failed:", dbError)

      return NextResponse.json({
        success: false,
        activeProcesses: [],
        message: `Database error: ${dbError.message}`,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error: any) {
    console.error("❌ Failed to get active checkpoints:", error)

    return NextResponse.json(
      { success: false, error: "Failed to retrieve active checkpoints", details: error.message },
      { status: 500 },
    )
  }
}
