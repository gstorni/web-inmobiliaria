import { NextResponse } from "next/server"
import { enhancedHybridCacheService } from "@/lib/enhanced-hybrid-cache-service"

export async function POST() {
  try {
    const result = await enhancedHybridCacheService.performPredictiveWarming()

    return NextResponse.json({
      success: true,
      message: `Predictive warming completed: ${result.warmed} properties warmed from ${result.predictions} predictions`,
      ...result,
    })
  } catch (error) {
    console.error("Predictive warming error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to perform predictive warming",
        warmed: 0,
        predictions: 0,
      },
      { status: 500 },
    )
  }
}
