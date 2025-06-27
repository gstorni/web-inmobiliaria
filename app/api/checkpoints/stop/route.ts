import { type NextRequest, NextResponse } from "next/server"
import { checkpointService } from "@/lib/checkpoint-service"
import { z } from "zod"

const stopProcessSchema = z.object({
  processId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const operationId = `api-stopProcess-${Date.now()}`
  console.log(`[${operationId}] Stop process API called`)

  try {
    const rawBody = await request.json().catch(() => ({}))
    const parseResult = stopProcessSchema.safeParse(rawBody)

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body", issues: parseResult.error.issues },
        { status: 400 },
      )
    }
    const { processId } = parseResult.data

    // Find the process to get its type
    // This is a simplified approach; a more robust way would be to query by processId only
    // or pass processType from client if known.
    // For now, assuming we might need to iterate or have a way to get type.
    // Let's assume the checkpoint service can handle stopping by ID or we find its type.
    // This part needs refinement based on how checkpointService is structured for stopping.
    // For now, we'll mark it as 'paused' or 'failed' if we can find it.

    // A simple approach: try to find it among active ones.
    const activeCheckpoints = await checkpointService.getActiveCheckpoints()
    const checkpointToStop = activeCheckpoints.find((p) => p.processId === processId)

    if (!checkpointToStop) {
      return NextResponse.json(
        { success: false, message: `Process ID ${processId} not found or not active.` },
        { status: 404 },
      )
    }

    await checkpointService.completeCheckpoint(
      checkpointToStop.processType,
      processId,
      "paused",
      "Manually stopped by user",
    )

    console.log(`[${operationId}] Process ${processId} (type: ${checkpointToStop.processType}) marked as paused.`)

    return NextResponse.json({
      success: true,
      message: `Stop request for process ${processId} (type: ${checkpointToStop.processType}) has been processed. It will be marked as 'paused'.`,
    })
  } catch (error: any) {
    console.error(`[${operationId}] Stop process error in API route:`, error)
    return NextResponse.json({ success: false, error: "Stop process failed", message: error.message }, { status: 500 })
  }
}
