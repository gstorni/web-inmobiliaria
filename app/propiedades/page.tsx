"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Filter,
  Grid,
  List,
  MapPin,
  Home,
  Ruler,
  Car,
  Bath,
  Bed,
  RefreshCw,
  AlertCircle,
  Loader2,
} from "lucide-react"
import Link from "next/link"

interface Property {
  tokko_id: number
  title: string
  description: string
  main_price: string | null
  surface: number | null
  covered_surface: number | null
  location_name: string | null
  location_full: string | null
  address: string | null
  property_type: string | null
  property_type_code: string | null
  operation_type: string | null
  rooms: number | null
  bathrooms: number | null
  parking_spaces: number | null
  featured: boolean
  status: string
  reference_code: string | null
}

interface SearchResponse {
  properties: Property[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [filters, setFilters] = useState({
    property_type: "",
    operation_type: "",
    min_price: "",
    max_price: "",
    min_surface: "",
    max_surface: "",
  })

  const fetchProperties = async (page = 1) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        ...(searchTerm && { search: searchTerm }),
        ...Object.fromEntries(Object.entries(filters).filter(([_, value]) => value !== "")),
      })

      const response = await fetch(`/api/properties/search?${params}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: SearchResponse = await response.json()

      setProperties(data.properties || [])
      setTotal(data.total || 0)
      setCurrentPage(data.page || 1)
      setTotalPages(data.totalPages || 1)
    } catch (error: any) {
      console.error("Error fetching properties:", error)
      setError(error.message)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/properties/sync-initial", {
        method: "POST",
      })

      if (response.ok) {
        const result = await response.json()
        console.log("Sync result:", result)
        // Refresh the properties list
        await fetchProperties()
      } else {
        throw new Error("Sync failed")
      }
    } catch (error: any) {
      console.error("Sync error:", error)
      setError("Error al sincronizar propiedades")
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchProperties()
  }, [])

  const handleSearch = () => {
    setCurrentPage(1)
    fetchProperties(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchProperties(page)
  }

  const formatPrice = (priceStr: string | null) => {
    if (!priceStr) return "Consultar precio"

    try {
      const price = JSON.parse(priceStr)
      if (price.amount) {
        return `${price.currency || "$"} ${price.amount.toLocaleString()}`
      }
    } catch (e) {
      // Ignore parsing errors
    }

    return "Consultar precio"
  }

  const PropertyCard = ({ property }: { property: Property }) => (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="p-0">
        <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
          <img
            src={`/placeholder.svg?height=200&width=300&text=${encodeURIComponent(property.title)}`}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Badge variant={property.featured ? "default" : "secondary"}>
                {property.property_type || "Propiedad"}
              </Badge>
              {property.featured && <Badge className="bg-yellow-500 text-yellow-900">Destacada</Badge>}
            </div>
            <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {property.title}
            </h3>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">
              {property.location_full || property.location_name || property.address || "Ubicación no especificada"}
            </span>
          </div>

          {/* Price */}
          <div className="text-xl font-bold text-primary">{formatPrice(property.main_price)}</div>

          {/* Details */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {property.surface && (
              <div className="flex items-center gap-1">
                <Ruler className="h-4 w-4" />
                <span>{property.surface} m²</span>
              </div>
            )}
            {property.rooms && (
              <div className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                <span>{property.rooms}</span>
              </div>
            )}
            {property.bathrooms && (
              <div className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                <span>{property.bathrooms}</span>
              </div>
            )}
            {property.parking_spaces && (
              <div className="flex items-center gap-1">
                <Car className="h-4 w-4" />
                <span>{property.parking_spaces}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">{property.description}</p>

          {/* Action */}
          <Link href={`/propiedades/${property.tokko_id}`}>
            <Button className="w-full mt-4">Ver Detalles</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )

  if (loading && properties.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando propiedades...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Propiedades Industriales</h1>
          <p className="text-muted-foreground">Encuentra la propiedad industrial perfecta para tu negocio</p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar propiedades..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <select
                  value={filters.property_type}
                  onChange={(e) => setFilters((prev) => ({ ...prev, property_type: e.target.value }))}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Tipo de Propiedad</option>
                  <option value="warehouse">Depósito</option>
                  <option value="industrial">Industrial</option>
                  <option value="office">Oficina</option>
                  <option value="land">Terreno</option>
                </select>

                <select
                  value={filters.operation_type}
                  onChange={(e) => setFilters((prev) => ({ ...prev, operation_type: e.target.value }))}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">Operación</option>
                  <option value="sale">Venta</option>
                  <option value="rent">Alquiler</option>
                </select>

                <Input
                  placeholder="Precio mín."
                  value={filters.min_price}
                  onChange={(e) => setFilters((prev) => ({ ...prev, min_price: e.target.value }))}
                  type="number"
                />

                <Input
                  placeholder="Precio máx."
                  value={filters.max_price}
                  onChange={(e) => setFilters((prev) => ({ ...prev, max_price: e.target.value }))}
                  type="number"
                />

                <Input
                  placeholder="Superficie mín."
                  value={filters.min_surface}
                  onChange={(e) => setFilters((prev) => ({ ...prev, min_surface: e.target.value }))}
                  type="number"
                />

                <Input
                  placeholder="Superficie máx."
                  value={filters.max_surface}
                  onChange={(e) => setFilters((prev) => ({ ...prev, max_surface: e.target.value }))}
                  type="number"
                />
              </div>

              <div className="flex justify-between items-center">
                <Button onClick={handleSearch} disabled={loading}>
                  <Filter className="h-4 w-4 mr-2" />
                  Aplicar Filtros
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-muted-foreground">{loading ? "Cargando..." : `${total} propiedades encontradas`}</p>
          </div>
          <Button onClick={() => fetchProperties(currentPage)} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-destructive mb-4">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-semibold">Error al cargar propiedades</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2">
                <Button onClick={() => fetchProperties(currentPage)} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar
                </Button>
                <Button onClick={handleSync} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar Propiedades
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && properties.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No se encontraron propiedades</h3>
              <p className="text-muted-foreground mb-6">
                No hay propiedades que coincidan con tus criterios de búsqueda.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => {
                    setSearchTerm("")
                    setFilters({
                      property_type: "",
                      operation_type: "",
                      min_price: "",
                      max_price: "",
                      min_surface: "",
                      max_surface: "",
                    })
                    fetchProperties(1)
                  }}
                  variant="outline"
                >
                  Limpiar Filtros
                </Button>
                <Button onClick={handleSync} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar Propiedades
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Properties Grid */}
        {properties.length > 0 && (
          <>
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8"
                  : "space-y-4 mb-8"
              }
            >
              {properties.map((property) => (
                <PropertyCard key={property.tokko_id} property={property} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                >
                  Anterior
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                        disabled={loading}
                      >
                        {page}
                      </Button>
                    )
                  })}
                  {totalPages > 5 && (
                    <>
                      <span className="px-2">...</span>
                      <Button
                        variant={currentPage === totalPages ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={loading}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
