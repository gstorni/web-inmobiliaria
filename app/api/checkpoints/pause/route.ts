import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { processType, processId } = await request.json()

    if (!processType || !processId) {
      return NextResponse.json({ success: false, message: "Process type and ID are required" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("processing_checkpoints")
      .update({
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("process_type", processType)
      .eq("process_id", processId)

    if (error) {
      throw new Error(`Failed to pause checkpoint: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: "Process paused successfully",
    })
  } catch (error) {
    console.error("❌ Failed to pause checkpoint:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to pause process",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
