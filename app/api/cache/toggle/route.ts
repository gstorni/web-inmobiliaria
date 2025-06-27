import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { action, component } = await request.json()

    if (component === "hybrid") {
      // Set environment variable for runtime control
      if (action === "enable") {
        process.env.HYBRID_CACHE_ENABLED = "true"
      } else if (action === "disable") {
        process.env.HYBRID_CACHE_ENABLED = "false"
      }

      return NextResponse.json({
        success: true,
        message: `Hybrid cache ${action}d successfully`,
        newState: process.env.HYBRID_CACHE_ENABLED,
      })
    }

    return NextResponse.json(
      {
        success: false,
        message: "Invalid component specified",
      },
      { status: 400 },
    )
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
