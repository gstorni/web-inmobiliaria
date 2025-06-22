import { type NextRequest, NextResponse } from "next/server"

// TokkoBroker API configuration
const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit") || "20"
    const offset = searchParams.get("offset") || "0"
    const propertyType = searchParams.get("type")
    const location = searchParams.get("location")

    // Build query parameters for TokkoBroker API
    const params = new URLSearchParams({
      key: TOKKO_API_KEY || "",
      limit,
      offset,
      format: "json",
    })

    if (propertyType) {
      params.append("property_type", propertyType)
    }

    if (location) {
      params.append("location", location)
    }

    const response = await fetch(`${TOKKO_API_URL}/property/?${params}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`TokkoBroker API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform TokkoBroker data to our format
    const transformedProperties =
      data.objects?.map((property: any) => ({
        id: property.id,
        title: property.publication_title || property.type?.name || "Propiedad Industrial",
        description: property.description || "",
        price: property.price,
        currency: property.currency || "USD",
        surface: property.surface || 0,
        location: `${property.location?.name || ""}, ${property.location?.parent?.name || ""}`.trim(),
        type: property.type?.name || "Industrial",
        images: property.photos?.map((photo: any) => photo.image) || [],
        featured: property.is_starred || false,
        contact: {
          name: property.real_estate_agency?.name || "",
          phone: property.real_estate_agency?.phone || "",
          email: property.real_estate_agency?.email || "",
        },
      })) || []

    return NextResponse.json({
      properties: transformedProperties,
      total: data.meta?.total_count || 0,
      hasNext: data.meta?.next !== null,
    })
  } catch (error) {
    console.error("Error fetching properties from TokkoBroker:", error)

    // Return mock data if API fails (for development)
    const mockProperties = [
      {
        id: 1,
        title: "Galpón Industrial Premium",
        description:
          "Moderno galpón industrial con oficinas administrativas, altura libre de 8m y acceso para camiones.",
        price: 250000,
        currency: "USD",
        surface: 2500,
        location: "Zona Industrial Norte, Buenos Aires",
        type: "Galpón",
        images: ["/placeholder.svg?height=400&width=600"],
        featured: true,
        contact: {
          name: "IndustrialPro",
          phone: "+54 11 4000-0000",
          email: "info@industrialpro.com.ar",
        },
      },
    ]

    return NextResponse.json({
      properties: mockProperties,
      total: mockProperties.length,
      hasNext: false,
      error: "Using mock data - TokkoBroker API unavailable",
    })
  }
}
