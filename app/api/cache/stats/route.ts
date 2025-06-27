import { NextResponse } from "next/server"
import { hybridCacheService } from "@/lib/hybrid-cache-service"

export async function GET() {
  try {
    const stats = hybridCacheService.getStats()

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error("❌ Failed to get hybrid cache stats:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get cache stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
