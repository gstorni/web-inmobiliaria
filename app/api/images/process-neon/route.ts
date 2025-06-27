import { NextResponse } from "next/server"
import { neonImageOptimization } from "@/lib/neon-image-optimization"

export async function POST() {
  try {
    const result = await neonImageOptimization.processPendingImages(20)

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      remaining: result.remaining,
    })
  } catch (error: any) {
    console.error("Image processing error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
