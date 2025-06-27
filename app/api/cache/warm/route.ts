import { NextResponse } from "next/server"
import { enhancedHybridCache } from "@/lib/enhanced-hybrid-cache-service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 50

    const result = await enhancedHybridCache.warmCache(limit)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Failed to warm cache:", error)
    return NextResponse.json({ success: false, message: "Failed to warm cache", error: error.message }, { status: 500 })
  }
}
