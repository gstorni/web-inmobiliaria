// TokkoBroker API Response Types
export interface TokkoLocation {
  id: number
  name: string
  parent?: {
    id: number
    name: string
  }
}

export interface TokkoPropertyType {
  id: number
  name: string
}

export interface TokkoPhoto {
  id: number
  image: string
  description?: string
  order: number
}

export interface TokkoRealEstateAgency {
  id: number
  name: string
  phone?: string
  email?: string
  whatsapp?: string
  website?: string
}

export interface TokkoPublisher {
  id: number
  name: string
  email?: string
  phone?: string
}

export interface TokkoTag {
  id: number
  name: string
}

export interface TokkoProperty {
  id: number
  publication_title?: string
  description?: string
  price: number
  currency: string
  surface?: number
  roofed_surface?: number
  location?: TokkoLocation
  address?: string
  type?: TokkoPropertyType
  operation_type?: string
  photos?: TokkoPhoto[]
  real_estate_agency?: TokkoRealEstateAgency
  publisher?: TokkoPublisher
  is_starred?: boolean
  geo_lat?: number
  geo_long?: number
  rooms?: number
  bathrooms?: number
  garages?: number
  age?: number
  orientation?: string
  tags?: TokkoTag[]
  created_at?: string
  updated_at?: string
}

export interface TokkoApiResponse<T> {
  objects?: T[]
  meta?: {
    total_count: number
    next: string | null
    previous: string | null
  }
}

export interface TokkoSinglePropertyResponse extends TokkoProperty {}

// Transformed property types for our application
export interface TransformedProperty {
  id: number
  title: string
  description: string
  price: number
  currency: string
  surface: number
  coveredSurface: number
  location: {
    name: string
    address: string
    neighborhood: string
    coordinates: {
      lat?: number
      lng?: number
    }
  }
  type: string
  operation: string
  images: Array<{
    url: string
    description: string
  }>
  features: {
    rooms: number
    bathrooms: number
    garages: number
    age: number
    orientation: string
    amenities: string[]
  }
  contact: {
    agency: string
    agent: string
    phone: string
    email: string
    whatsapp: string
  }
  featured: boolean
  createdAt?: string
  updatedAt?: string
}
