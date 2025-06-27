import { NextResponse } from "next/server"
import { enhancedHybridCache } from "@/lib/enhanced-hybrid-cache-service"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const result = await enhancedHybridCache.clearRedisCache()
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Failed to clear Redis cache:", error)
    return NextResponse.json(
      { success: false, message: "Failed to clear Redis cache", error: error.message },
      { status: 500 },
    )
  }
}
