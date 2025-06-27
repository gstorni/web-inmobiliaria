import { NextResponse } from "next/server"
import { enhancedHybridCache } from "@/lib/enhanced-hybrid-cache-service"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const status = enhancedHybridCache.getConnectionStatus()
    return NextResponse.json(status)
  } catch (error: any) {
    console.error("Failed to get connection status:", error)
    return NextResponse.json({ error: "Failed to retrieve connection status", details: error.message }, { status: 500 })
  }
}
