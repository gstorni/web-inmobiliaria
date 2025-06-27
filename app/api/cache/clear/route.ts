import { NextResponse } from "next/server"
import { hybridCacheService } from "@/lib/hybrid-cache-service"

export async function POST() {
  const operationId = `api-cacheClear-${Date.now()}`
  console.log(`[${operationId}] Cache clear API called`)
  try {
    // Clear Redis (non-blocking, respects limited mode)
    if (hybridCacheService["redis"] && !hybridCacheService["redisLimited"]) {
      hybridCacheService["redis"].flushdb().catch((err) => console.error(`[${operationId}] Redis flushdb error:`, err))
      console.log(`[${operationId}] Redis flushdb command sent.`)
    } else {
      console.log(`[${operationId}] Redis not active or in limited mode, flushdb skipped.`)
    }

    // Mark all PostgreSQL cache entries as stale (or delete, depending on strategy)
    // For now, let's just log. A full clear might be too destructive without confirmation.
    // A more common approach is to invalidate specific keys or use TTLs.
    // For a "full clear" button, one might delete from `properties_cache` or update `sync_status`.
    // This is a placeholder for a more nuanced strategy.
    console.log(`[${operationId}] PostgreSQL cache clear/stale marking would be implemented here.`)
    // Example: await supabaseAdmin.from("properties_cache").update({ sync_status: "stale" }).neq("sync_status", "stale");

    return NextResponse.json({
      success: true,
      message: "Cache clear process initiated (Redis flush sent, PostgreSQL needs specific strategy).",
    })
  } catch (error: any) {
    console.error(`[${operationId}] Cache clear error in API route:`, error)
    return NextResponse.json(
      { success: false, error: "Cache clear initiation failed", message: error.message },
      { status: 500 },
    )
  }
}
