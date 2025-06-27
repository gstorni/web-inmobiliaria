import { type NextRequest, NextResponse } from "next/server"
import { dataFlowAnalyzer } from "@/scripts/analyze-data-flow"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get("propertyId")

    if (!propertyId) {
      return NextResponse.json(
        {
          error: "Property ID is required",
        },
        { status: 400 },
      )
    }

    const analysis = await dataFlowAnalyzer.analyzeProperty(Number.parseInt(propertyId))

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Data flow analysis error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { propertyIds } = await request.json()

    if (!Array.isArray(propertyIds)) {
      return NextResponse.json(
        {
          error: "Property IDs array is required",
        },
        { status: 400 },
      )
    }

    const results = []
    for (const propertyId of propertyIds) {
      const analysis = await dataFlowAnalyzer.analyzeProperty(propertyId)
      results.push(analysis)
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        redisAvailable: results.filter((r) => r.dataFlow.redis.available).length,
        neonAvailable: results.filter((r) => r.dataFlow.neon.available).length,
        apiAvailable: results.filter((r) => r.dataFlow.api.available).length,
        imagesProcessed: results.reduce((sum, r) => sum + r.imageFlow.processedImages, 0),
        totalImages: results.reduce((sum, r) => sum + r.imageFlow.originalImages, 0),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Batch data flow analysis error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    )
  }
}
