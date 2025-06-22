interface TokkoConfig {
  apiKey: string
  baseUrl: string
}

interface PropertyFilters {
  type?: string
  location?: string
  minPrice?: number
  maxPrice?: number
  minSurface?: number
  maxSurface?: number
  operation?: "sale" | "rent"
  limit?: number
  offset?: number
}

interface TokkoProperty {
  id: number
  publication_title: string
  description: string
  price: number
  currency: string
  surface: number
  roofed_surface?: number
  location: {
    name: string
    parent?: { name: string }
  }
  address: string
  type: { name: string }
  operation_type: string
  photos: Array<{ image: string; description?: string }>
  real_estate_agency: {
    name: string
    phone: string
    email: string
    whatsapp?: string
  }
  publisher?: { name: string }
  is_starred: boolean
  geo_lat?: number
  geo_long?: number
  rooms?: number
  bathrooms?: number
  garages?: number
  age?: number
  orientation?: string
  tags?: Array<{ name: string }>
  created_at: string
  updated_at: string
}

interface TokkoResponse {
  objects: TokkoProperty[]
  meta: {
    total_count: number
    next: string | null
    previous: string | null
  }
}

export class TokkoClient {
  private config: TokkoConfig

  constructor(config: TokkoConfig) {
    this.config = config
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`)

    // Add API key and format to all requests
    url.searchParams.append("key", this.config.apiKey)
    url.searchParams.append("format", "json")

    // Add additional parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`TokkoBroker API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getProperties(filters: PropertyFilters = {}): Promise<TokkoResponse> {
    const params: Record<string, string> = {}

    if (filters.type) params.property_type = filters.type
    if (filters.location) params.location = filters.location
    if (filters.minPrice) params.price_from = filters.minPrice.toString()
    if (filters.maxPrice) params.price_to = filters.maxPrice.toString()
    if (filters.minSurface) params.surface_from = filters.minSurface.toString()
    if (filters.maxSurface) params.surface_to = filters.maxSurface.toString()
    if (filters.operation) params.operation_type = filters.operation
    if (filters.limit) params.limit = filters.limit.toString()
    if (filters.offset) params.offset = filters.offset.toString()

    return this.makeRequest<TokkoResponse>("/property/", params)
  }

  async getProperty(id: number): Promise<TokkoProperty> {
    return this.makeRequest<TokkoProperty>(`/property/${id}/`)
  }

  async getPropertyTypes(): Promise<Array<{ id: number; name: string }>> {
    const response = await this.makeRequest<{ objects: Array<{ id: number; name: string }> }>("/property_type/")
    return response.objects
  }

  async getLocations(): Promise<Array<{ id: number; name: string; parent?: { name: string } }>> {
    const response = await this.makeRequest<{
      objects: Array<{ id: number; name: string; parent?: { name: string } }>
    }>("/location/")
    return response.objects
  }

  async searchProperties(query: string, filters: PropertyFilters = {}): Promise<TokkoResponse> {
    const params = { q: query, ...filters }
    return this.getProperties(params as PropertyFilters)
  }
}

// Create a singleton instance
export const tokkoClient = new TokkoClient({
  apiKey: process.env.TOKKO_API_KEY || "",
  baseUrl: "https://www.tokkobroker.com/api/v1",
})

// Utility functions for data transformation
export function transformTokkoProperty(property: TokkoProperty) {
  return {
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
      property.photos?.map((photo) => ({
        url: photo.image,
        description: photo.description || "",
      })) || [],
    features: {
      rooms: property.rooms || 0,
      bathrooms: property.bathrooms || 0,
      garages: property.garages || 0,
      age: property.age || 0,
      orientation: property.orientation || "",
      amenities: property.tags?.map((tag) => tag.name) || [],
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
}
