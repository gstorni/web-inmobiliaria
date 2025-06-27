// Updated TokkoBroker API Response Types based on real API response
export interface TokkoLocation {
  id: number
  name: string
  full_location: string
  short_location: string
  parent_division?: string
  divisions?: Array<{
    id: number
    name: string
    resource_uri: string
  }>
  state?: any
  weight: number
  zip_code?: string
}

export interface TokkoPropertyType {
  id: number
  name: string
  code: string
}

export interface TokkoPhoto {
  id: number
  image: string
  description?: string
  order: number
}

export interface TokkoBranch {
  id: number
  name: string
  display_name: string
  email: string
  phone: string
  phone_area: string
  alternative_phone?: string
  address: string
  logo?: string
  contact_time?: string
  geo_lat?: string
  geo_long?: string
}

export interface TokkoProducer {
  id: number
  name: string
  email: string
  phone?: string
  cellphone?: string
  picture?: string
  position?: string
}

export interface TokkoTag {
  id: number
  name: string
}

export interface TokkoCustomTag {
  id: number
  name: string
}

export interface TokkoExtraAttribute {
  name: string
  value: string
  is_measure: boolean
  is_expenditure: boolean
}

// Updated price structure based on real API response
export interface TokkoPrice {
  currency: string
  period: number // 0 = one-time, 1 = monthly, etc.
  price: number
}

export interface TokkoOperation {
  operation_id: number
  operation_type: string // "Sale", "Rent", etc.
  prices: TokkoPrice[]
}

// Updated property interface based on real TokkoBroker schema
export interface TokkoProperty {
  id: number

  // Core property information
  publication_title?: string
  reference_code?: string
  description?: string
  rich_description?: string

  // Operations with nested prices (confirmed structure)
  operations?: TokkoOperation[]

  // Legacy price fields (fallback)
  web_price?: boolean | number
  expenses?: number

  // Dimensions - confirmed field names
  surface?: string // String in API, represents total surface
  roofed_surface?: string // String in API, covered surface
  unroofed_surface?: string // String in API, uncovered surface
  total_surface?: string // String in API
  semiroofed_surface?: string // String in API
  surface_measurement?: string // "M2"

  // Room details - confirmed field names
  room_amount?: number // Ambientes
  bathroom_amount?: number // Baños
  toilet_amount?: number // Toilettes
  suite_amount?: number // Suites
  parking_lot_amount?: number // Parking spaces
  floors_amount?: number // Number of floors

  // Location - confirmed structure
  address?: string
  real_address?: string
  fake_address?: string
  geo_lat?: string // String in API
  geo_long?: string // String in API
  gm_location_type?: string
  location?: TokkoLocation

  // Property details - confirmed fields
  type?: TokkoPropertyType
  age?: number
  orientation?: string | null
  property_condition?: string
  situation?: string
  zonification?: string

  // Media - confirmed structure
  photos?: TokkoPhoto[]
  videos?: any[]
  files?: any[]

  // Agency and producer information - confirmed structure
  branch?: TokkoBranch
  producer?: TokkoProducer

  // Additional fields - confirmed
  is_starred_on_web?: boolean
  tags?: TokkoTag[]
  custom_tags?: TokkoCustomTag[]
  extra_attributes?: TokkoExtraAttribute[]

  // Dates
  created_at?: string
  deleted_at?: string | null

  // Status and requirements
  status?: number
  transaction_requirements?: string
  has_temporary_rent?: boolean
  is_denounced?: boolean
  legally_checked?: string

  // Measurements
  depth_measure?: string
  front_measure?: string

  // Custom fields
  custom1?: string
  portal_footer?: string
  public_url?: string

  // Development info
  development?: any
  development_excel_extra_data?: string
  disposition?: any
  occupation?: any[]
}

export interface TokkoApiResponse<T> {
  objects?: T[]
  meta?: {
    total_count: number
    next: string | null
    previous: string | null
  }
}

export type TokkoSinglePropertyResponse = TokkoProperty

// Updated transformed property types for our application
export interface PropertyPrice {
  operation: string // "Sale", "Rent", etc.
  operationId: number
  price: number
  currency: string
  period: number // 0 = one-time, 1 = monthly
  formatted: string
}

export interface TransformedProperty {
  id: number
  title: string
  referenceCode: string
  description: string
  richDescription: string

  // Multiple prices for different operations
  prices: PropertyPrice[]
  mainPrice: PropertyPrice // Primary price to display
  availableOperations: string[]

  // Dimensions (converted from strings to numbers)
  surface: number // Total surface (metros lote)
  coveredSurface: number // Roofed surface (metros construidos)
  uncoveredSurface: number // Unroofed surface
  totalSurface: number // Total surface

  // Location
  location: {
    name: string
    fullLocation: string
    shortLocation: string
    address: string
    realAddress: string
    coordinates: {
      lat?: number
      lng?: number
    }
  }

  // Property details
  type: string
  typeCode: string
  operation: string
  age?: number
  condition: string
  situation: string
  zonification: string

  // Room details
  rooms: number // room_amount
  bathrooms: number // bathroom_amount
  toilets: number // toilet_amount
  suites: number // suite_amount
  parkingSpaces: number // parking_lot_amount
  floors: number // floors_amount

  // Media
  images: Array<{
    url: string
    description: string
  }>
  videos: Array<{
    url: string
    description: string
  }>

  // Features and amenities
  features: {
    orientation: string
    amenities: string[]
    extraAttributes: Array<{
      name: string
      value: string
      isMeasure: boolean
      isExpenditure: boolean
    }>
  }

  // Contact
  contact: {
    branch: {
      name: string
      displayName: string
      email: string
      phone: string
      address: string
      logo?: string
      contactTime?: string
    }
    agent: {
      name: string
      email: string
      phone: string
      cellphone?: string
      picture?: string
      position: string
    }
  }

  // Status and requirements
  featured: boolean
  status: number
  transactionRequirements: string
  hasTemporaryRent: boolean
  expenses: number

  // Dates
  createdAt?: string
  deletedAt?: string | null

  // URLs
  publicUrl?: string
}
