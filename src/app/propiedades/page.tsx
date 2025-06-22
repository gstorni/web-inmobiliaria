"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Building2, MapPin, Search, Filter, Grid, List } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface Property {
  id: number
  title: string
  location: string
  price: number
  currency: string
  surface: number
  type: string
  description: string
  featured: boolean
  images: string[]
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchTerm, setSearchTerm] = useState("")
  const [filters, setFilters] = useState({
    type: "",
    location: "",
    minPrice: "",
    maxPrice: "",
    minSurface: "",
    maxSurface: "",
  })

  useEffect(() => {
    // Simulate API call to TokkoBroker
    const fetchProperties = async () => {
      setLoading(true)
      // This would be replaced with actual TokkoBroker API call
      const mockProperties: Property[] = [
        {
          id: 1,
          title: "Galpón Industrial Premium",
          location: "Zona Industrial Norte",
          price: 250000,
          currency: "USD",
          surface: 2500,
          type: "Galpón",
          description:
            "Moderno galpón industrial con oficinas administrativas, altura libre de 8m y acceso para camiones.",
          featured: true,
          images: ["/placeholder.svg?height=300&width=400"],
        },
        {
          id: 2,
          title: "Depósito Logístico",
          location: "Zona Sur",
          price: 180000,
          currency: "USD",
          surface: 1800,
          type: "Depósito",
          description: "Depósito ideal para logística con múltiples docks de carga y descarga.",
          featured: false,
          images: ["/placeholder.svg?height=300&width=400"],
        },
        {
          id: 3,
          title: "Terreno Industrial",
          location: "Zona Oeste",
          price: 120000,
          currency: "USD",
          surface: 5000,
          type: "Terreno",
          description: "Amplio terreno industrial con todos los servicios, ideal para construcción.",
          featured: true,
          images: ["/placeholder.svg?height=300&width=400"],
        },
        {
          id: 4,
          title: "Nave Industrial",
          location: "Capital Federal",
          price: 450000,
          currency: "USD",
          surface: 4200,
          type: "Nave Industrial",
          description: "Gran nave industrial con grúa puente y instalaciones eléctricas de alta potencia.",
          featured: false,
          images: ["/placeholder.svg?height=300&width=400"],
        },
      ]

      setTimeout(() => {
        setProperties(mockProperties)
        setLoading(false)
      }, 1000)
    }

    fetchProperties()
  }, [])

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.location.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !filters.type || property.type === filters.type
    const matchesLocation = !filters.location || property.location.includes(filters.location)

    return matchesSearch && matchesType && matchesLocation
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow">
                  <div className="h-48 bg-gray-300 rounded-t-lg"></div>
                  <div className="p-6">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2 mb-4"></div>
                    <div className="h-6 bg-gray-300 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Propiedades Industriales</h1>
              <p className="text-gray-600 mt-2">{filteredProperties.length} propiedades encontradas</p>
            </div>
            <Link href="/" className="flex items-center text-blue-600 hover:text-blue-800">
              <Building2 className="h-6 w-6 mr-2" />
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="p-6">
                <div className="flex items-center mb-6">
                  <Filter className="h-5 w-5 mr-2" />
                  <h2 className="text-lg font-semibold">Filtros</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Buscar</label>
                    <Input
                      placeholder="Buscar propiedades..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo de Propiedad</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    >
                      <option value="">Todos los tipos</option>
                      <option value="Galpón">Galpón</option>
                      <option value="Depósito">Depósito</option>
                      <option value="Terreno">Terreno Industrial</option>
                      <option value="Nave Industrial">Nave Industrial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Ubicación</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={filters.location}
                      onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    >
                      <option value="">Todas las zonas</option>
                      <option value="Norte">Zona Norte</option>
                      <option value="Sur">Zona Sur</option>
                      <option value="Oeste">Zona Oeste</option>
                      <option value="Capital">Capital Federal</option>
                    </select>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => {
                      setSearchTerm("")
                      setFilters({
                        type: "",
                        location: "",
                        minPrice: "",
                        maxPrice: "",
                        minSurface: "",
                        maxSurface: "",
                      })
                    }}
                    variant="outline"
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Properties Grid */}
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2">
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

              <select className="p-2 border border-gray-300 rounded-md">
                <option>Ordenar por precio</option>
                <option>Precio: menor a mayor</option>
                <option>Precio: mayor a menor</option>
                <option>Superficie: menor a mayor</option>
                <option>Superficie: mayor a menor</option>
              </select>
            </div>

            <div
              className={`grid gap-6 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}
            >
              {filteredProperties.map((property) => (
                <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className={`relative ${viewMode === "grid" ? "h-48" : "h-64 md:h-48"}`}>
                    <Image
                      src={property.images[0] || "/placeholder.svg"}
                      alt={property.title}
                      fill
                      className="object-cover"
                    />
                    {property.featured && <Badge className="absolute top-4 left-4 bg-blue-600">Destacada</Badge>}
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      {property.location}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{property.title}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">{property.description}</p>
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {property.currency} {property.price.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">{property.surface.toLocaleString()} m²</div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" asChild>
                        <Link href={`/propiedades/${property.id}`}>Ver Detalles</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/contacto">Consultar</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProperties.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron propiedades</h3>
                <p className="text-gray-600">Intenta ajustar los filtros de búsqueda</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
