import { NextResponse } from "next/server"
import { hybridCacheService } from "@/lib/hybrid-cache-service"

export async function GET() {
  try {
    const stats = hybridCacheService.getStats()

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cache stats error:", error)
    return NextResponse.json({ success: false, message: "Failed to get cache stats" }, { status: 500 })
  }
}
