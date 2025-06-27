import { NextResponse } from "next/server"
import { performanceMonitor } from "@/lib/performance-monitor"

export async function GET() {
  try {
    const health = performanceMonitor.getSystemHealth()

    return NextResponse.json({
      success: true,
      health,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("System health check error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to get system health",
      },
      { status: 500 },
    )
  }
}
