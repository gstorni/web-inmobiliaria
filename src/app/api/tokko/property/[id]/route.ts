import { type NextRequest, NextResponse } from "next/server"

const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const propertyId = params.id

    const response = await fetch(`${TOKKO_API_URL}/property/${propertyId}/?key=${TOKKO_API_KEY}&format=json`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`TokkoBroker API error: ${response.status}`)
    }

    const property = await response.json()

    // Transform single property data
    const transformedProperty = {
      id: property.id,
      title: property.publication_title || property.type?.name || "Propiedad Industrial",
      description: property.description || "",
      price: property.price,
      currency: property.currency || "USD",
      surface: property.surface || 0,
      coveredSurface: property.roofed_surface || 0,
      location: {
        name: property.location?.name || "",
        address: property.address || "",
        neighborhood: property.location?.parent?.name || "",
        coordinates: {
          lat: property.geo_lat,
          lng: property.geo_long,
        },
      },
      type: property.type?.name || "Industrial",
      operation: property.operation_type || "Venta",
      images:
        property.photos?.map((photo: any) => ({
          url: photo.image,
          description: photo.description || "",
        })) || [],
      features: {
        rooms: property.rooms || 0,
        bathrooms: property.bathrooms || 0,
        garages: property.garages || 0,
        age: property.age || 0,
        orientation: property.orientation || "",
        amenities: property.tags?.map((tag: any) => tag.name) || [],
      },
      contact: {
        agency: property.real_estate_agency?.name || "",
        agent: property.publisher?.name || "",
        phone: property.real_estate_agency?.phone || "",
        email: property.real_estate_agency?.email || "",
        whatsapp: property.real_estate_agency?.whatsapp || "",
      },
      featured: property.is_starred || false,
      createdAt: property.created_at,
      updatedAt: property.updated_at,
    }

    return NextResponse.json(transformedProperty)
  } catch (error) {
    console.error("Error fetching property from TokkoBroker:", error)

    // Return mock data if API fails
    const mockProperty = {
      id: Number.parseInt(params.id),
      title: "Galpón Industrial Premium",
      description:
        "Moderno galpón industrial ubicado en zona estratégica con excelente conectividad. Cuenta con oficinas administrativas, altura libre de 8 metros, acceso para camiones de gran porte y todas las instalaciones necesarias para operaciones industriales de gran escala.",
      price: 250000,
      currency: "USD",
      surface: 2500,
      coveredSurface: 2200,
      location: {
        name: "Zona Industrial Norte",
        address: "Av. Industrial 1234",
        neighborhood: "Buenos Aires",
        coordinates: { lat: -34.6037, lng: -58.3816 },
      },
      type: "Galpón",
      operation: "Venta",
      images: [
        { url: "/placeholder.svg?height=400&width=600", description: "Vista exterior" },
        { url: "/placeholder.svg?height=400&width=600", description: "Interior del galpón" },
        { url: "/placeholder.svg?height=400&width=600", description: "Oficinas administrativas" },
      ],
      features: {
        rooms: 4,
        bathrooms: 2,
        garages: 3,
        age: 5,
        orientation: "Norte",
        amenities: ["Grúa puente", "Oficinas", "Vestuarios", "Comedor", "Seguridad 24hs"],
      },
      contact: {
        agency: "IndustrialPro",
        agent: "Juan Pérez",
        phone: "+54 11 4000-0000",
        email: "info@industrialpro.com.ar",
        whatsapp: "+54 9 11 4000-0000",
      },
      featured: true,
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-20T15:30:00Z",
    }

    return NextResponse.json(mockProperty)
  }
}
