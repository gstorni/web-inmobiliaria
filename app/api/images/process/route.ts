import { type NextRequest, NextResponse } from "next/server"
import { hybridCacheService } from "@/lib/hybrid-cache-service"
import { z } from "zod"

const imageProcessSchema = z.object({
  mode: z.enum(["full", "incremental"]).default("incremental"),
  limit: z.number().int().min(1).max(500).default(50), // Property limit
  batchSize: z.number().int().min(1).max(100).default(20), // Image batch size for ImageOptimizationService
  processId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const operationId = `api-imageProcess-${Date.now()}`
  console.log(`[${operationId}] Image processing API called`)

  try {
    const rawBody = await request.json().catch(() => ({}))
    const parseResult = imageProcessSchema.safeParse(rawBody)

    if (!parseResult.success) {
      console.error(`[${operationId}] Invalid request body:`, parseResult.error.issues)
      return NextResponse.json(
        { success: false, error: "Invalid request body", issues: parseResult.error.issues },
        { status: 400 },
      )
    }
    const { mode, limit, batchSize, processId } = parseResult.data

    console.log(
      `[${operationId}] Starting image processing (mode: ${mode}, property_limit: ${limit}, image_batch: ${batchSize}, processId: ${processId || "new"})`,
    )

    if (!/* Supabase URL removed */) {
      console.error(`[${operationId}] Missing Supabase environment variables.`)
      return NextResponse.json(
        { success: false, error: "Server configuration error", message: "Missing Database credentials." },
        { status: 500 },
      )
    }

    hybridCacheService
      .processImages({ mode, limit, batchSize, processId })
      .then((result) => {
        console.log(`[${result.processId}] Background image processing finished: ${result.message}`)
      })
      .catch((error) => {
        console.error(`[${processId || operationId}] Background image processing error:`, error)
      })

    return NextResponse.json({
      success: true,
      message: `Image processing (mode: ${mode}) initiated. Process ID: ${processId || "will be generated"}. Monitor status via active checkpoints.`,
      processId: processId || "being_generated",
    })
  } catch (error: any) {
    console.error(`[${operationId}] Image processing error in API route:`, error)
    return NextResponse.json(
      { success: false, error: "Image processing initiation failed", message: error.message },
      { status: 500 },
    )
  }
}
