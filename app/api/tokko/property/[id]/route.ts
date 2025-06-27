import { type NextRequest, NextResponse } from "next/server"
import type { TokkoSinglePropertyResponse } from "@/lib/tokko-types"
import { transformTokkoProperty } from "@/lib/tokko-transformer"

const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id: propertyId } = await context.params

    const response = await fetch(`${TOKKO_API_URL}/property/${propertyId}/?key=${TOKKO_API_KEY}&format=json`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 },
    })

    if (response.ok) {
      const property: TokkoSinglePropertyResponse = await response.json()
      const transformedProperty = transformTokkoProperty(property)
      return NextResponse.json(transformedProperty)
    }

    // If property not found, return mock data using the transformer
    console.log(`Property ${propertyId} not found in TokkoBroker API (${response.status}), using mock data`)

    const mockProperty = generateMockTokkoProperty(Number.parseInt(propertyId))
    const transformedMockProperty = transformTokkoProperty(mockProperty)

    return NextResponse.json(transformedMockProperty)
  } catch (error) {
    console.error("Error fetching property from TokkoBroker:", error)

    const { id } = await context.params
    const mockProperty = generateMockTokkoProperty(Number.parseInt(id))
    const transformedMockProperty = transformTokkoProperty(mockProperty)

    return NextResponse.json(transformedMockProperty)
  }
}

function generateMockTokkoProperty(id: number): TokkoSinglePropertyResponse {
  const mockProperties = [
    {
      publication_title: "Galpón Industrial Premium",
      description:
        "Moderno galpón industrial ubicado en zona estratégica con excelente conectividad. Cuenta con oficinas administrativas, altura libre de 8 metros, acceso para camiones de gran porte y todas las instalaciones necesarias para operaciones industriales de gran escala.",
      web_price: 250000,
      surface: 2500,
      roofed_surface: 2200,
      room_amount: 4,
      bathroom_amount: 2,
      garage_amount: 3,
      location: "Zona Industrial Norte",
      type: "Galpón",
      amenities: ["Grúa puente", "Oficinas", "Vestuarios", "Comedor", "Seguridad 24hs"],
    },
    {
      publication_title: "Depósito Logístico Estratégico",
      description:
        "Amplio depósito logístico con múltiples docks de carga y descarga, ideal para operaciones de distribución. Ubicado en zona de alta conectividad con acceso directo a rutas principales.",
      web_price: 180000,
      surface: 1800,
      roofed_surface: 1600,
      room_amount: 2,
      bathroom_amount: 1,
      garage_amount: 2,
      location: "Zona Sur",
      type: "Depósito",
      amenities: ["Múltiples docks", "Oficinas", "Patio de maniobras", "Báscula"],
    },
    {
      publication_title: "Terreno Industrial con Servicios",
      description:
        "Amplio terreno industrial con todos los servicios disponibles, ideal para construcción de planta industrial. Excelente ubicación con fácil acceso a rutas y servicios.",
      web_price: 120000,
      surface: 5000,
      roofed_surface: 0,
      room_amount: 0,
      bathroom_amount: 0,
      garage_amount: 0,
      location: "Zona Oeste",
      type: "Terreno",
      amenities: ["Todos los servicios", "Acceso a rutas", "Zonificación industrial"],
    },
    {
      publication_title: "Nave Industrial con Grúa",
      description:
        "Gran nave industrial equipada con grúa puente e instalaciones eléctricas de alta potencia. Perfecta para industrias pesadas y manufactura especializada.",
      web_price: 450000,
      surface: 4200,
      roofed_surface: 4000,
      room_amount: 6,
      bathroom_amount: 3,
      garage_amount: 4,
      location: "Capital Federal",
      type: "Nave Industrial",
      amenities: ["Grúa puente", "Alta potencia eléctrica", "Oficinas técnicas", "Vestuarios"],
    },
  ]

  const mockIndex = (id - 1) % mockProperties.length
  const mock = mockProperties[mockIndex]

  return {
    id,
    publication_title: mock.publication_title,
    reference_code: `REF-${id.toString().padStart(4, "0")}`,
    description: mock.description,
    web_price: mock.web_price,
    currency: "USD",
    surface: mock.surface,
    roofed_surface: mock.roofed_surface,
    room_amount: mock.room_amount,
    bathroom_amount: mock.bathroom_amount,
    garage_amount: mock.garage_amount,
    address: `Av. Industrial ${1000 + id * 100}`,
    geo_lat: -34.6037 + id * 0.01,
    geo_long: -58.3816 + id * 0.01,
    location: {
      id: id,
      name: mock.location,
      parent: { id: 1, name: "Buenos Aires" },
    },
    type: { id: id, name: mock.type },
    operation_type: "Venta",
    available_operations: ["Venta"],
    age: Math.floor(Math.random() * 10) + 1,
    orientation: ["Norte", "Sur", "Este", "Oeste"][Math.floor(Math.random() * 4)],
    photos: [
      {
        id: 1,
        image: `/placeholder.svg?height=400&width=600&query=${mock.type} exterior view`,
        description: "Vista exterior",
        order: 1,
      },
      {
        id: 2,
        image: `/placeholder.svg?height=400&width=600&query=${mock.type} interior space`,
        description: "Interior",
        order: 2,
      },
    ],
    real_estate_agency: {
      id: 1,
      name: "Agustín Mieres Propiedades",
      phone: "+54 11 4000-0000",
      email: "info@agustinmieres.com.ar",
      whatsapp: "+54 9 11 4000-0000",
    },
    publisher: { id: 1, name: "Agustín Mieres" },
    is_starred: id <= 3,
    tags: mock.amenities.map((amenity, index) => ({ id: index + 1, name: amenity })),
    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
}
