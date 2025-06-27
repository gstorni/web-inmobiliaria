import { NextResponse } from "next/server"
import { enhancedMultiTierCache } from "@/lib/enhanced-multi-tier-cache"

export async function GET() {
  try {
    const stats = await enhancedMultiTierCache.getCacheStats()

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error: any) {
    console.error("Cache stats error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
