import { type NextRequest, NextResponse } from "next/server"
import { hybridCacheService } from "@/lib/hybrid-cache-service"
import { z } from "zod"

const syncRequestSchema = z.object({
  mode: z.enum(["full", "incremental"]).default("incremental"),
  limit: z.number().int().min(1).max(1000).default(100),
  processId: z.string().optional(), // Allow resuming a specific process
})

export async function POST(request: NextRequest) {
  const operationId = `api-propertySync-${Date.now()}`
  console.log(`[${operationId}] Property sync API called`)

  try {
    const rawBody = await request.json().catch(() => ({}))
    const parseResult = syncRequestSchema.safeParse(rawBody)

    if (!parseResult.success) {
      console.error(`[${operationId}] Invalid request body:`, parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: "Invalid request body", issues: parseResult.error.issues },
        { status: 400 },
      )
    }
    const { mode, limit, processId } = parseResult.data

    console.log(`[${operationId}] Starting sync (mode: ${mode}, limit: ${limit}, processId: ${processId || "new"})`)

    // Basic environment variable check (hybridCacheService will do more detailed checks)
    if (!process.env.TOKKO_API_KEY || !/* Supabase URL removed */) {
      console.error(`[${operationId}] Missing critical environment variables.`)
      return NextResponse.json(
        { success: false, error: "Server configuration error", message: "Missing API or Database credentials." },
        { status: 500 },
      )
    }

    // Non-blocking: Start the sync process but don't wait for it to complete.
    // The client will poll for status using the processId.
    hybridCacheService
      .syncProperties({ mode, limit, processId })
      .then((result) => {
        console.log(`[${result.processId}] Background sync finished: ${result.message}`)
      })
      .catch((error) => {
        console.error(`[${processId || operationId}] Background sync error:`, error)
      })

    return NextResponse.json({
      success: true,
      message: `Property sync (mode: ${mode}) initiated. Process ID: ${processId || "will be generated"}. Monitor status via active checkpoints.`,
      processId: processId || "being_generated", // Client can use this to track, or wait for first checkpoint update
    })
  } catch (error: any) {
    console.error(`[${operationId}] Sync error in API route:`, error)
    return NextResponse.json(
      { success: false, error: "Sync initiation failed", message: error.message },
      { status: 500 },
    )
  }
}
