import { NextResponse } from "next/server"
import { hybridCacheService } from "@/lib/hybrid-cache-service"

export const revalidate = 0 // Ensure dynamic fetching for up-to-date stats

export async function GET() {
  try {
    const stats = await hybridCacheService.getCacheStats()
    // The getCacheStats method now includes an 'error' field if it partially fails or has a critical failure.
    // We can check for that if we want to return a different status code, but for now,
    // we'll assume it returns a best-effort stats object.
    // If stats.error exists, the dashboard can display it.

    if (stats.redisMode === "error" && stats.error) {
      // A more specific check for critical failure within getCacheStats
      console.error("Error reported by hybridCacheService.getCacheStats():", stats.error)
      return NextResponse.json(
        { success: false, error: "Failed to get complete cache stats", details: stats.error, stats }, // Send partial stats if available
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, ...stats }) // Spread the stats object directly
  } catch (error: any) {
    // This catch block is for unexpected errors thrown by getCacheStats or Next.js itself
    console.error("Critical error in /api/properties/cache-stats route:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Server error while fetching cache statistics.",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
