import type { TokkoProperty, TransformedProperty, PropertyPrice } from "./tokko-types"

/**
 * Transform TokkoBroker property data to our application format
 * Based on real TokkoBroker API response structure
 */
export function transformTokkoProperty(property: TokkoProperty): TransformedProperty {
  // Handle the operations/prices structure (confirmed from real API)
  const prices: PropertyPrice[] = []

  if (property.operations && property.operations.length > 0) {
    // Use the operations array (confirmed structure)
    property.operations.forEach((operation) => {
      operation.prices.forEach((priceInfo) => {
        if (priceInfo.price > 0) {
          prices.push({
            operation: mapOperationType(operation.operation_type),
            operationId: operation.operation_id,
            price: priceInfo.price,
            currency: priceInfo.currency,
            period: priceInfo.period,
            formatted: formatPrice(priceInfo.price, priceInfo.currency, priceInfo.period),
          })
        }
      })
    })
  }

  // If no prices found, add a consultation price
  if (prices.length === 0) {
    prices.push({
      operation: "Consultar",
      operationId: 0,
      price: 0,
      currency: "USD",
      period: 0,
      formatted: "Consulte precio",
    })
  }

  // Select main price (prefer "Venta" over "Alquiler")
  const mainPrice = prices.find((p) => p.operation === "Venta") || prices[0]

  // Handle available operations
  const availableOperations = property.operations
    ? property.operations.map((op) => mapOperationType(op.operation_type))
    : prices.map((p) => p.operation)

  // Convert string dimensions to numbers (API returns strings)
  const surface = Number.parseFloat(property.surface || "0") || 0
  const coveredSurface = Number.parseFloat(property.roofed_surface || "0") || 0
  const uncoveredSurface = Number.parseFloat(property.unroofed_surface || "0") || 0
  const totalSurface = Number.parseFloat(property.total_surface || "0") || surface

  // Handle coordinates (API returns strings)
  const lat = property.geo_lat ? Number.parseFloat(property.geo_lat) : undefined
  const lng = property.geo_long ? Number.parseFloat(property.geo_long) : undefined

  // Handle images - support both photos array and single photo
  const images: Array<{ url: string; description: string }> = []

  if (property.photos && property.photos.length > 0) {
    images.push(
      ...property.photos.map((photo) => ({
        url: photo.image,
        description: photo.description || "",
      })),
    )
  }

  // Handle videos
  const videos: Array<{ url: string; description: string }> = []
  if (property.videos && property.videos.length > 0) {
    videos.push(
      ...property.videos.map((video: any) => ({
        url: video.url || video.video || "",
        description: video.description || "",
      })),
    )
  }

  return {
    id: property.id,
    title: property.publication_title || property.type?.name || "Propiedad Industrial",
    referenceCode: property.reference_code || `REF-${property.id}`,
    description: property.description || "",
    richDescription: property.rich_description || "",

    // Multiple prices
    prices,
    mainPrice,
    availableOperations,

    // Dimensions - converted from strings to numbers
    surface,
    coveredSurface,
    uncoveredSurface,
    totalSurface,

    // Location - using confirmed API structure
    location: {
      name: property.location?.name || "",
      fullLocation: property.location?.full_location || "",
      shortLocation: property.location?.short_location || "",
      address: property.address || "",
      realAddress: property.real_address || property.address || "",
      coordinates: {
        lat,
        lng,
      },
    },

    // Property details - using confirmed fields
    type: property.type?.name || "Industrial",
    typeCode: property.type?.code || "",
    operation: mainPrice.operation,
    age: property.age,
    condition: property.property_condition || "",
    situation: property.situation || "",
    zonification: property.zonification || "",

    // Room details - using confirmed field names
    rooms: property.room_amount || 0,
    bathrooms: property.bathroom_amount || 0,
    toilets: property.toilet_amount || 0,
    suites: property.suite_amount || 0,
    parkingSpaces: property.parking_lot_amount || 0,
    floors: property.floors_amount || 1,

    // Media
    images,
    videos,

    // Features - using confirmed structure
    features: {
      orientation: property.orientation || "",
      amenities: property.tags?.map((tag) => tag.name) || [],
      extraAttributes:
        property.extra_attributes?.map((attr) => ({
          name: attr.name,
          value: attr.value,
          isMeasure: attr.is_measure,
          isExpenditure: attr.is_expenditure,
        })) || [],
    },

    // Contact - using confirmed branch and producer structure
    contact: {
      branch: {
        name: property.branch?.name || "",
        displayName: property.branch?.display_name || "",
        email: property.branch?.email || "",
        phone: formatPhone(property.branch?.phone_area, property.branch?.phone),
        address: property.branch?.address || "",
        logo: property.branch?.logo,
        contactTime: property.branch?.contact_time,
      },
      agent: {
        name: property.producer?.name || "",
        email: property.producer?.email || "",
        phone: property.producer?.phone || "",
        cellphone: property.producer?.cellphone || "",
        picture: property.producer?.picture,
        position: property.producer?.position || "",
      },
    },

    // Status and requirements - using confirmed fields
    featured: property.is_starred_on_web || false,
    status: property.status || 0,
    transactionRequirements: property.transaction_requirements || "",
    hasTemporaryRent: property.has_temporary_rent || false,
    expenses: property.expenses || 0,

    // Dates
    createdAt: property.created_at,
    deletedAt: property.deleted_at,

    // URLs
    publicUrl: property.public_url,
  }
}

/**
 * Map TokkoBroker operation types to Spanish
 */
function mapOperationType(operationType: string): string {
  const operationMap: Record<string, string> = {
    Sale: "Venta",
    Rent: "Alquiler",
    "Temporary Rent": "Alquiler Temporal",
    "Commercial Rent": "Alquiler Comercial",
    Auction: "Subasta",
    Exchange: "Permuta",
  }

  return operationMap[operationType] || operationType
}

/**
 * Format price with currency and period
 */
function formatPrice(price: number, currency = "USD", period = 0): string {
  if (!price || price === 0) return "Consulte precio"

  const formattedPrice = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)

  // Add period suffix for recurring payments
  if (period === 1) {
    return `${formattedPrice}/mes`
  } else if (period === 12) {
    return `${formattedPrice}/año`
  }

  return formattedPrice
}

/**
 * Format phone number with area code
 */
function formatPhone(areaCode?: string, phone?: string): string {
  if (!phone) return ""
  if (!areaCode) return phone

  return `+54 ${areaCode} ${phone}`
}

/**
 * Get all available operations as a formatted string
 */
export function formatAvailableOperations(operations: string[]): string {
  if (operations.length === 0) return "Consultar"
  if (operations.length === 1) return operations[0]
  return operations.join(" | ")
}

/**
 * Format multiple prices for display
 */
export function formatMultiplePrices(prices: PropertyPrice[]): string {
  if (prices.length === 0) return "Consulte precio"
  if (prices.length === 1) return prices[0].formatted

  return prices.map((p) => `${p.formatted} (${p.operation})`).join(" | ")
}

/**
 * Get property summary for listings
 */
export function getPropertySummary(property: TransformedProperty): {
  title: string
  prices: string
  location: string
  surface: string
  rooms: string
  reference: string
} {
  return {
    title: property.title,
    prices: formatMultiplePrices(property.prices),
    location: `${property.location.address}, ${property.location.name}`,
    surface: `${property.surface.toLocaleString()} m²${property.coveredSurface > 0 ? ` (${property.coveredSurface.toLocaleString()} m² cubiertos)` : ""}`,
    rooms: property.rooms > 0 ? `${property.rooms} ambientes` : "",
    reference: property.referenceCode,
  }
}

/**
 * Extract key features from extra attributes
 */
export function extractKeyFeatures(property: TransformedProperty): string[] {
  const features: string[] = []

  // Add surface info
  if (property.surface > 0) {
    features.push(`${property.surface.toLocaleString()} m² total`)
  }
  if (property.coveredSurface > 0) {
    features.push(`${property.coveredSurface.toLocaleString()} m² cubiertos`)
  }

  // Add room info
  if (property.rooms > 0) {
    features.push(`${property.rooms} ambientes`)
  }
  if (property.bathrooms > 0) {
    features.push(`${property.bathrooms} baños`)
  }

  // Add extra attributes (like ceiling height) - with null check
  if (property.features?.extraAttributes) {
    property.features.extraAttributes.forEach((attr) => {
      if (attr.isMeasure && attr.value) {
        features.push(`${attr.name}: ${attr.value}`)
      }
    })
  }

  // Add age if available
  if (property.age && property.age > 0) {
    features.push(`${property.age} años`)
  }

  return features
}
