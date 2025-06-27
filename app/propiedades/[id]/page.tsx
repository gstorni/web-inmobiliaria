import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Home, Ruler, Car, Bath, Bed, Phone, Mail, DollarSign, Calendar, Building } from "lucide-react"
import { enhancedHybridCache } from "@/lib/enhanced-hybrid-cache-service"

async function getProperty(id: string) {
  try {
    const property = await enhancedHybridCache.getProperty(id)
    return { property }
  } catch (error) {
    console.error("Error fetching property:", error)
    return { property: null }
  }
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { property } = await getProperty(id)

  if (!property) {
    notFound()
  }

  const mainPrice = property.main_price ? JSON.parse(property.main_price) : null
  const coordinates = property.coordinates ? JSON.parse(property.coordinates) : null
  const extraAttributes = property.extra_attributes ? JSON.parse(property.extra_attributes) : {}
  const contactInfo = property.contact_info ? JSON.parse(property.contact_info) : {}

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span>Propiedades</span>
            <span>/</span>
            <span>{property.reference_code || property.tokko_id}</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{property.title}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{property.location_full || property.address}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Images */}
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={`/placeholder.svg?height=400&width=600&text=${encodeURIComponent(property.title)}`}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {property.rich_description ? (
                    <div dangerouslySetInnerHTML={{ __html: property.rich_description }} />
                  ) : (
                    <p className="text-muted-foreground">{property.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Property Details */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles de la Propiedad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {property.surface && (
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Superficie Total</p>
                        <p className="font-medium">{property.surface} m²</p>
                      </div>
                    </div>
                  )}

                  {property.covered_surface && (
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Superficie Cubierta</p>
                        <p className="font-medium">{property.covered_surface} m²</p>
                      </div>
                    </div>
                  )}

                  {property.rooms && (
                    <div className="flex items-center gap-2">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Ambientes</p>
                        <p className="font-medium">{property.rooms}</p>
                      </div>
                    </div>
                  )}

                  {property.bathrooms && (
                    <div className="flex items-center gap-2">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Baños</p>
                        <p className="font-medium">{property.bathrooms}</p>
                      </div>
                    </div>
                  )}

                  {property.parking_spaces && (
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Cocheras</p>
                        <p className="font-medium">{property.parking_spaces}</p>
                      </div>
                    </div>
                  )}

                  {property.age && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Antigüedad</p>
                        <p className="font-medium">{property.age} años</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Amenities */}
            {property.amenities && (
              <Card>
                <CardHeader>
                  <CardTitle>Comodidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.split(",").map((amenity, index) => (
                      <Badge key={index} variant="secondary">
                        {amenity.trim()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Precio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mainPrice ? (
                  <div>
                    <p className="text-3xl font-bold text-primary">
                      {mainPrice.currency} {mainPrice.amount?.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {property.operation_type === "sale" ? "Venta" : "Alquiler"}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Consultar precio</p>
                )}
              </CardContent>
            </Card>

            {/* Property Type */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Tipo de Propiedad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="text-sm">
                  {property.property_type}
                </Badge>
                {property.featured && <Badge className="ml-2">Destacada</Badge>}
              </CardContent>
            </Card>

            {/* Contact */}
            {contactInfo && Object.keys(contactInfo).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contactInfo.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{contactInfo.phone}</span>
                    </div>
                  )}
                  {contactInfo.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{contactInfo.email}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Button className="w-full">
                      <Phone className="h-4 w-4 mr-2" />
                      Llamar
                    </Button>
                    <Button variant="outline" className="w-full bg-transparent">
                      <Mail className="h-4 w-4 mr-2" />
                      Consultar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reference */}
            <Card>
              <CardHeader>
                <CardTitle>Información</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Referencia:</span>
                  <span className="font-medium">{property.reference_code || property.tokko_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge variant={property.status === "active" ? "default" : "secondary"}>
                    {property.status === "active" ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                {property.tokko_updated_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Actualizada:</span>
                    <span className="text-sm">{new Date(property.tokko_updated_at).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
