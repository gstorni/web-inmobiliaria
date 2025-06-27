import { NextResponse } from "next/server"
import { enhancedHybridCache } from "@/lib/enhanced-hybrid-cache-service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const { propertyId } = await request.json()

    if (!propertyId) {
      return NextResponse.json({ success: false, message: "Property ID is required" }, { status: 400 })
    }

    const result = await enhancedHybridCache.invalidateProperty(Number(propertyId))
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Failed to invalidate property:", error)
    return NextResponse.json(
      { success: false, message: "Failed to invalidate property", error: error.message },
      { status: 500 },
    )
  }
}
