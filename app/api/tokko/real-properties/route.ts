import { type NextRequest, NextResponse } from "next/server"
import { secureTokkoClient } from "@/lib/enhanced-tokko-client"

// New endpoint to get real property IDs from TokkoBroker
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "10"

    // Fetch real properties from TokkoBroker
    const properties = await secureTokkoClient.getProperties({ limit })

    // Return just the IDs and basic info for testing
    const realProperties =
      properties.objects?.map((property) => ({
        id: property.id,
        title: property.publication_title || property.type?.name || "Propiedad",
        price: property.price,
        currency: property.currency,
        location: property.location?.name,
        type: property.type?.name,
      })) || []

    return NextResponse.json({
      success: true,
      count: realProperties.length,
      properties: realProperties,
      message: "These are real property IDs you can use for testing",
    })
  } catch (error) {
    console.error("Error fetching real properties:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch real properties",
        message: "Check your TOKKO_API_KEY or try again later",
      },
      { status: 500 },
    )
  }
}
