import { NextResponse } from "next/server"
import { hybridCacheService } from "@/lib/hybrid-cache-service"

export async function GET() {
  try {
    const stats = await hybridCacheService.getCacheStats()

    return NextResponse.json({
      success: true,
      state: {
        hybridCacheEnabled: process.env.HYBRID_CACHE_ENABLED !== "false",
        redisEnabled: stats.performanceDetails?.redis?.connected || false,
        postgresEnabled: true, // PostgreSQL is always enabled
        mode: stats.redisMode || "postgresql-only",
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
