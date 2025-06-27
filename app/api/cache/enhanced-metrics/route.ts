import { NextResponse } from "next/server"
import { enhancedHybridCache } from "@/lib/enhanced-hybrid-cache-service"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const metrics = enhancedHybridCache.getMetrics()
    return NextResponse.json(metrics)
  } catch (error: any) {
    console.error("Failed to get enhanced cache metrics:", error)
    return NextResponse.json({ error: "Failed to retrieve cache metrics", details: error.message }, { status: 500 })
  }
}
