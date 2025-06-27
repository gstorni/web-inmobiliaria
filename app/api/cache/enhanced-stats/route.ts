import { NextResponse } from "next/server"
import { enhancedHybridCacheService } from "@/lib/enhanced-hybrid-cache-service"

export async function GET() {
  try {
    const stats = enhancedHybridCacheService.getEnhancedStats()

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Enhanced cache stats error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get enhanced cache stats",
      },
      { status: 500 },
    )
  }
}
