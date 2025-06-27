import { type NextRequest, NextResponse } from "next/server"
import { enhancedHybridCache } from "@/lib/enhanced-hybrid-cache-service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const propertyId = Number.parseInt(id)

    if (isNaN(propertyId)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 })
    }

    console.log(`🔍 Fetching property ${propertyId}...`)

    const property = await enhancedHybridCache.getProperty(propertyId.toString())

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    return NextResponse.json({ property })
  } catch (error: any) {
    console.error("❌ Error fetching property:", error)
    return NextResponse.json({ error: "Failed to fetch property", details: error.message }, { status: 500 })
  }
}
