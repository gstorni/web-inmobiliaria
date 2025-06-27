"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  ArrowLeft,
  Bed,
  Bath,
  Car,
  Calendar,
  Compass,
  Ruler,
  Star,
  Share2,
  Heart,
  ChevronLeft,
  ChevronRight,
  User,
  Building,
  DollarSign,
  Zap,
  Database,
  Cloud,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import type { TransformedProperty } from "@/lib/tokko-types"
import { extractKeyFeatures } from "@/lib/tokko-transformer"

// Cache source indicator component
function CacheSourceIndicator({ source, responseTime }: { source?: string; responseTime?: number }) {
  if (!source) return null

  const getSourceInfo = (source: string) => {
    switch (source) {
      case "redis":
        return { icon: Zap, color: "text-green-600 bg-green-50 border-green-200", label: "Redis Cache" }
      case "postgres":
      case "neon":
        return { icon: Database, color: "text-blue-600 bg-blue-50 border-blue-200", label: "Neon Cache" }
      case "api":
        return { icon: Cloud, color: "text-orange-600 bg-orange-50 border-orange-200", label: "API Call" }
      default:
        return { icon: Database, color: "text-gray-600 bg-gray-50 border-gray-200", label: "Cache" }
    }
  }

  const { icon: Icon, color, label } = getSourceInfo(source)

  return (
    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
      {responseTime && <span className="ml-1">({responseTime}ms)</span>}
    </div>
  )
}

interface PropertyDetailPageProps {
  property: TransformedProperty
  cacheMetadata?: {
    source?: string
    responseTime?: number
    hitRate?: number
  }
}

// Helper function to safely get price information
function getPriceInfo(property: TransformedProperty) {
  // Try to get mainPrice first
  if (property.mainPrice && property.mainPrice.formatted) {
    return {
      price: property.mainPrice.formatted,
      operation: property.mainPrice.operation || property.operation || "Consultar",
    }
  }

  // Try to get first price from prices array
  if (property.prices && property.prices.length > 0) {
    const firstPrice = property.prices[0]
    if (firstPrice && firstPrice.formatted) {
      return {
        price: firstPrice.formatted,
        operation: firstPrice.operation || property.operation || "Consultar",
      }
    }
  }

  // Fallback to basic operation
  return {
    price: "Consulte precio",
    operation: property.operation || "Consultar",
  }
}

// Helper function to safely get available operations
function getAvailableOperations(property: TransformedProperty): string[] {
  if (property.availableOperations && property.availableOperations.length > 0) {
    return property.availableOperations
  }

  if (property.prices && property.prices.length > 0) {
    return property.prices.map((p) => p.operation).filter(Boolean)
  }

  return property.operation ? [property.operation] : ["Consultar"]
}

// Helper function to safely get contact information
function getContactInfo(property: TransformedProperty) {
  const contact = property.contact || {}
  const branch = contact.branch || {}
  const agent = contact.agent || {}

  return {
    branch: {
      name: branch.name || branch.displayName || "Inmobiliaria",
      displayName: branch.displayName || branch.name || "Inmobiliaria",
      email: branch.email || "",
      phone: branch.phone || "",
      address: branch.address || "",
      logo: branch.logo || null,
      contactTime: branch.contactTime || "",
    },
    agent: {
      name: agent.name || "",
      email: agent.email || "",
      phone: agent.phone || "",
      cellphone: agent.cellphone || "",
      picture: agent.picture || null,
      position: agent.position || "",
    },
  }
}

// Helper function to safely get location information
function getLocationInfo(property: TransformedProperty) {
  const location = property.location || {}

  return {
    name: location.name || "",
    fullLocation: location.fullLocation || location.full_location || "",
    shortLocation: location.shortLocation || location.short_location || "",
    address: location.address || "",
    realAddress: location.realAddress || location.real_address || location.address || "",
    coordinates: location.coordinates || { lat: 0, lng: 0 },
  }
}

// Helper function to safely get features
function getFeatures(property: TransformedProperty) {
  const features = property.features || {}

  return {
    orientation: features.orientation || "",
    amenities: features.amenities || [],
    extraAttributes: features.extraAttributes || [],
  }
}

export function PropertyDetailPage({ property, cacheMetadata }: PropertyDetailPageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)

  // Safely extract property information
  const priceInfo = getPriceInfo(property)
  const availableOperations = getAvailableOperations(property)
  const contact = getContactInfo(property)
  const location = getLocationInfo(property)
  const features = getFeatures(property)

  // Safely get images
  const images = property.images || []
  const hasImages = images.length > 0

  const nextImage = () => {
    if (hasImages) {
      setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
    }
  }

  const prevImage = () => {
    if (hasImages) {
      setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: property.title || "Propiedad Industrial",
          text: property.description || "",
          url: window.location.href,
        })
      } catch (error) {
        console.log("Error sharing:", error)
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href)
      alert("Link copiado al portapapeles")
    }
  }

  const keyFeatures = extractKeyFeatures(property)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/propiedades" className="flex items-center text-blue-600 hover:text-blue-800 transition-colors">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Volver a Propiedades
            </Link>

            <div className="flex items-center space-x-2">
              {/* Cache Source Indicator */}
              {cacheMetadata && (
                <CacheSourceIndicator source={cacheMetadata.source} responseTime={cacheMetadata.responseTime} />
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFavorite(!isFavorite)}
                className={isFavorite ? "text-red-500 border-red-500" : ""}
              >
                <Heart className={`h-4 w-4 mr-1 ${isFavorite ? "fill-current" : ""}`} />
                {isFavorite ? "Guardado" : "Guardar"}
              </Button>

              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1" />
                Compartir
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <Card className="overflow-hidden">
              <div className="relative h-96 md:h-[500px]">
                {hasImages ? (
                  <>
                    <Image
                      src={images[currentImageIndex]?.url || "/placeholder.svg"}
                      alt={images[currentImageIndex]?.description || property.title || "Propiedad Industrial"}
                      fill
                      className="object-cover"
                    />

                    {images.length > 1 && (
                      <>
                        <button
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>

                        <button
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                          {images.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentImageIndex(index)}
                              className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentImageIndex ? "bg-white" : "bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-200">
                    <Building2 className="h-16 w-16 text-gray-400" />
                  </div>
                )}

                {property.featured && (
                  <Badge className="absolute top-4 left-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold shadow-lg">
                    <Star className="h-3 w-3 mr-1" />
                    Destacada
                  </Badge>
                )}

                <Badge className="absolute top-4 right-4 bg-gray-800 text-white">
                  {property.referenceCode || `REF-${property.id}`}
                </Badge>
              </div>
            </Card>

            {/* Property Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{property.title || "Propiedad Industrial"}</CardTitle>
                    <div className="flex items-center text-gray-600 mb-4">
                      <MapPin className="h-4 w-4 mr-1" />
                      {location.fullLocation || `${location.address}, ${location.name}` || "Ubicación no disponible"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">{priceInfo.price}</div>
                    <div className="text-sm text-gray-500">{priceInfo.operation}</div>
                    {availableOperations.length > 1 && (
                      <div className="text-xs text-gray-500 mt-1">
                        También: {availableOperations.filter((op) => op !== priceInfo.operation).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Key Features Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <Ruler className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-semibold">{(property.surface || 0).toLocaleString()} m²</div>
                      <div className="text-xs text-gray-500">Superficie total</div>
                    </div>
                  </div>

                  {property.coveredSurface && property.coveredSurface > 0 && (
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-semibold">{property.coveredSurface.toLocaleString()} m²</div>
                        <div className="text-xs text-gray-500">Superficie cubierta</div>
                      </div>
                    </div>
                  )}

                  {property.rooms && property.rooms > 0 && (
                    <div className="flex items-center space-x-2">
                      <Bed className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-semibold">{property.rooms}</div>
                        <div className="text-xs text-gray-500">Ambientes</div>
                      </div>
                    </div>
                  )}

                  {property.bathrooms && property.bathrooms > 0 && (
                    <div className="flex items-center space-x-2">
                      <Bath className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-semibold">{property.bathrooms}</div>
                        <div className="text-xs text-gray-500">Baños</div>
                      </div>
                    </div>
                  )}

                  {property.parkingSpaces && property.parkingSpaces > 0 && (
                    <div className="flex items-center space-x-2">
                      <Car className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-semibold">{property.parkingSpaces}</div>
                        <div className="text-xs text-gray-500">Cocheras</div>
                      </div>
                    </div>
                  )}

                  {property.age && property.age > 0 && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-semibold">{property.age} años</div>
                        <div className="text-xs text-gray-500">Antigüedad</div>
                      </div>
                    </div>
                  )}

                  {features.orientation && (
                    <div className="flex items-center space-x-2">
                      <Compass className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-semibold">{features.orientation}</div>
                        <div className="text-xs text-gray-500">Orientación</div>
                      </div>
                    </div>
                  )}

                  {property.expenses && property.expenses > 0 && (
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-semibold">${property.expenses.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Expensas</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">Descripción</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {property.description || property.richDescription || "Sin descripción disponible."}
                  </p>
                </div>

                {/* Transaction Requirements */}
                {property.transactionRequirements && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Requisitos de la Transacción</h3>
                    <p className="text-gray-700 leading-relaxed bg-yellow-50 p-3 rounded-lg">
                      {property.transactionRequirements}
                    </p>
                  </div>
                )}

                {/* Extra Attributes */}
                {features.extraAttributes && features.extraAttributes.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Características Especiales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {features.extraAttributes.map((attr, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="font-medium">{attr.name}</span>
                          <span className="text-gray-600">{attr.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {features.amenities && features.amenities.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Características</h3>
                    <div className="flex flex-wrap gap-2">
                      {features.amenities.map((amenity, index) => (
                        <Badge key={index} variant="outline">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Card */}
            <Card>
              <CardHeader>
                <CardTitle>Contactar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Branch Info */}
                <div className="text-center">
                  {contact.branch.logo && (
                    <div className="mb-3">
                      <Image
                        src={contact.branch.logo || "/placeholder.svg"}
                        alt={contact.branch.name}
                        width={120}
                        height={60}
                        className="mx-auto"
                      />
                    </div>
                  )}
                  <h3 className="font-semibold text-lg">{contact.branch.displayName}</h3>
                  {contact.agent.name && (
                    <p className="text-gray-600 flex items-center justify-center mt-1">
                      <User className="h-4 w-4 mr-1" />
                      {contact.agent.name}
                    </p>
                  )}
                  {contact.branch.contactTime && (
                    <p className="text-sm text-gray-500 mt-1">Horario: {contact.branch.contactTime}</p>
                  )}
                </div>

                <div className="space-y-3">
                  {contact.branch.phone && (
                    <Button className="w-full" asChild>
                      <Link href={`tel:${contact.branch.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Llamar
                      </Link>
                    </Button>
                  )}

                  {contact.agent.cellphone && (
                    <Button variant="outline" className="w-full" asChild>
                      <Link
                        href={`https://wa.me/${contact.agent.cellphone.replace(/[^\d]/g, "")}?text=Hola, me interesa la propiedad: ${property.title} (${property.referenceCode})`}
                        target="_blank"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </Link>
                    </Button>
                  )}

                  {contact.branch.email && (
                    <Button variant="outline" className="w-full" asChild>
                      <Link
                        href={`mailto:${contact.branch.email}?subject=Consulta sobre ${property.title} (${property.referenceCode})`}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </Link>
                    </Button>
                  )}

                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/contacto?property=${property.id}`}>Enviar Consulta</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Property Details */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium">{property.type || "Industrial"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Código:</span>
                  <span className="font-medium">{property.typeCode || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Operación:</span>
                  <span className="font-medium">{priceInfo.operation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Superficie:</span>
                  <span className="font-medium">{(property.surface || 0).toLocaleString()} m²</span>
                </div>
                {property.coveredSurface && property.coveredSurface > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sup. Cubierta:</span>
                    <span className="font-medium">{property.coveredSurface.toLocaleString()} m²</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Ubicación:</span>
                  <span className="font-medium">{location.name || "N/A"}</span>
                </div>
                {property.condition && property.condition !== "---" && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <span className="font-medium">{property.condition}</span>
                  </div>
                )}
                {property.createdAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Publicado:</span>
                    <span className="font-medium">{new Date(property.createdAt).toLocaleDateString("es-AR")}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Metrics Card */}
            {cacheMetadata && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Rendimiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fuente:</span>
                    <CacheSourceIndicator source={cacheMetadata.source} />
                  </div>
                  {cacheMetadata.responseTime && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tiempo:</span>
                      <span className="font-medium">{cacheMetadata.responseTime}ms</span>
                    </div>
                  )}
                  {cacheMetadata.hitRate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Hit Rate:</span>
                      <span className="font-medium">{(cacheMetadata.hitRate * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Map placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Ubicación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <MapPin className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Mapa próximamente</p>
                    <p className="text-xs">{location.address || "Dirección no disponible"}</p>
                    {location.coordinates.lat && location.coordinates.lng && (
                      <p className="text-xs text-gray-400 mt-1">
                        {location.coordinates.lat.toFixed(4)}, {location.coordinates.lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Public URL */}
            {property.publicUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Enlaces</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={property.publicUrl} target="_blank">
                      <Building className="h-4 w-4 mr-2" />
                      Ver en TokkoBroker
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
