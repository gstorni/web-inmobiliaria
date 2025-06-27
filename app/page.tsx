import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, Phone, Mail, Search, Zap, Database, Cloud } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { OurCustomers } from "@/components/our-customers"
import { StatisticsSection } from "@/components/statistics-section"

// Cache source indicator component
function CacheSourceIndicator({ source, responseTime }: { source?: string; responseTime?: number }) {
  if (!source) return null

  const getSourceInfo = (source: string) => {
    switch (source) {
      case "redis":
        return { icon: Zap, color: "text-green-600 bg-green-50", label: "Redis" }
      case "postgres":
        return { icon: Database, color: "text-blue-600 bg-blue-50", label: "PostgreSQL" }
      case "api":
        return { icon: Cloud, color: "text-orange-600 bg-orange-50", label: "API" }
      default:
        return { icon: Database, color: "text-gray-600 bg-gray-50", label: "Cache" }
    }
  }

  const { icon: Icon, color, label } = getSourceInfo(source)

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
      {responseTime && <span className="ml-1">({responseTime}ms)</span>}
    </div>
  )
}

// Fetch featured properties using hybrid cache
async function getFeaturedProperties() {
  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"
    const startTime = Date.now()

    const response = await fetch(`${baseUrl}/api/properties/search?featured=true&limit=3`, {
      next: { revalidate: 600 }, // Cache for 10 minutes
    })

    const responseTime = Date.now() - startTime

    if (!response.ok) {
      console.warn("Failed to fetch featured properties, using fallback")
      return { properties: [], cacheSource: "fallback", responseTime }
    }

    const data = await response.json()

    console.log(`🌟 Featured properties loaded from ${data.meta?.cacheSource || "unknown"} in ${responseTime}ms`)

    return {
      properties: data.properties || [],
      cacheSource: data.meta?.cacheSource,
      responseTime: data.meta?.responseTime || responseTime,
    }
  } catch (error) {
    console.error("Error fetching featured properties:", error)
    return { properties: [], cacheSource: "error", responseTime: 0 }
  }
}

export default async function HomePage() {
  const { properties: featuredProperties, cacheSource, responseTime } = await getFeaturedProperties()

  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />

      {/* Featured Properties */}
      <FeaturedProperties properties={featuredProperties} cacheSource={cacheSource} responseTime={responseTime} />

      {/* Services Section */}
      <ServicesSection />

      {/* Our Customers Section */}
      <OurCustomers />

      {/* Statistics Section */}
      <StatisticsSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  )
}

function FeaturedProperties({
  properties,
  cacheSource,
  responseTime,
}: {
  properties: any[]
  cacheSource?: string
  responseTime?: number
}) {
  // Fallback to placeholder data if no properties loaded
  const displayProperties =
    properties.length > 0
      ? properties
      : [
          {
            id: 1,
            title: "Galpón Industrial Premium",
            location: { name: "Zona Industrial Norte" },
            description:
              "Moderno galpón industrial de 3000 m² con oficinas administrativas, altura libre de 8m y acceso para camiones.",
            mainPrice: { formatted: "USD 200,000", operation: "Venta" },
            surface: 3000,
            type: "Galpón Industrial",
            images: [{ url: "/placeholder.svg?height=200&width=400" }],
            referenceCode: "REF-001",
            featured: true,
            availableOperations: ["Venta"],
          },
          {
            id: 2,
            title: "Nave Industrial Moderna",
            location: { name: "Parque Industrial Sur" },
            description:
              "Nave industrial de 4000 m² con tecnología de punta, sistemas de seguridad y amplias áreas de carga.",
            mainPrice: { formatted: "USD 250,000", operation: "Venta" },
            surface: 4000,
            type: "Nave Industrial",
            images: [{ url: "/placeholder.svg?height=200&width=400" }],
            referenceCode: "REF-002",
            featured: true,
            availableOperations: ["Venta"],
          },
          {
            id: 3,
            title: "Depósito Logístico",
            location: { name: "Zona Logística Este" },
            description:
              "Depósito logístico de 3500 m² ideal para distribución, con muelles de carga y sistemas automatizados.",
            mainPrice: { formatted: "USD 300,000", operation: "Venta" },
            surface: 3500,
            type: "Depósito",
            images: [{ url: "/placeholder.svg?height=200&width=400" }],
            referenceCode: "REF-003",
            featured: true,
            availableOperations: ["Venta"],
          },
        ]

  return (
    <section className="py-16 bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
              Propiedades Destacadas
            </h2>
            <CacheSourceIndicator source={cacheSource} responseTime={responseTime} />
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto transition-colors duration-300">
            Descubrí nuestras mejores opciones en propiedades industriales, seleccionadas especialmente para tu negocio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayProperties.map((property, index) => (
            <Card
              key={property.id || index}
              className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
              <div className="relative h-48">
                <Image
                  src={
                    property.images?.[0]?.url ||
                    `/placeholder.svg?height=200&width=400&query=industrial warehouse ${index + 1}`
                  }
                  alt={property.title}
                  fill
                  className="object-cover"
                />
                {property.featured && (
                  <Badge className="absolute top-4 left-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold shadow-lg">
                    ⭐ Destacada
                  </Badge>
                )}
                <Badge className="absolute top-4 right-4 bg-gray-800 text-white text-xs">
                  {property.referenceCode || `REF-${property.id}`}
                </Badge>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">
                  <MapPin className="h-4 w-4 mr-1" />
                  {property.location?.name || "Ubicación disponible"}
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-300">
                  {property.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 transition-colors duration-300 line-clamp-3">
                  {property.description}
                </p>
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        property.mainPrice?.operation === "Venta"
                          ? "border-green-500 text-green-700 bg-green-50"
                          : "border-blue-500 text-blue-700 bg-blue-50"
                      }`}
                    >
                      {property.mainPrice?.operation || "Venta"}
                    </Badge>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400 transition-colors duration-300">
                      {property.mainPrice?.formatted || "Consulte precio"}
                    </div>
                  </div>
                  {property.availableOperations?.length > 1 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
                      También disponible:{" "}
                      {property.availableOperations.filter((op) => op !== property.mainPrice?.operation).join(", ")}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                    {property.surface?.toLocaleString() || "0"} m²
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                    {property.type || "Industrial"}
                  </div>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/propiedades/${property.id}`}>Ver Detalles</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" asChild>
            <Link href="/propiedades">Ver Todas las Propiedades</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function ServicesSection() {
  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">
            Nuestros Servicios
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto transition-colors duration-300">
            Ofrecemos servicios integrales para satisfacer todas tus necesidades inmobiliarias industriales.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { title: "Venta", desc: "Propiedades industriales en venta", icon: "🏭" },
            { title: "Alquiler", desc: "Espacios industriales para alquilar", icon: "📋" },
            { title: "Asesoramiento", desc: "Consultoría especializada", icon: "💼" },
            { title: "Tasaciones", desc: "Valuaciones profesionales", icon: "📊" },
          ].map((service, i) => (
            <Card
              key={i}
              className="text-center p-6 hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            >
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-300">
                {service.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 transition-colors duration-300">{service.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="py-16 bg-blue-600 dark:bg-blue-800 text-white transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold mb-4">¿Listo para encontrar tu propiedad industrial?</h2>
        <p className="text-xl mb-8 text-blue-100 dark:text-blue-200 transition-colors duration-300">
          Nuestro equipo de expertos está aquí para ayudarte a encontrar el espacio perfecto para tu negocio.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100" asChild>
            <Link href="/contacto">
              <Mail className="mr-2 h-5 w-5" />
              Contactar Ahora
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-blue-600"
            asChild
          >
            <Link href="/propiedades">
              <Search className="mr-2 h-5 w-5" />
              Explorar Propiedades
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-gray-900 dark:bg-black text-white py-12 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="h-8 w-8 text-blue-400" />
              <span className="text-xl font-bold">IndustrialPro</span>
            </div>
            <p className="text-gray-400 dark:text-gray-500 transition-colors duration-300">
              Especialistas en propiedades industriales con más de 15 años de experiencia en el mercado.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Servicios</h3>
            <ul className="space-y-2 text-gray-400 dark:text-gray-500 transition-colors duration-300">
              <li>
                <Link href="/servicios" className="hover:text-white">
                  Venta
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="hover:text-white">
                  Alquiler
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="hover:text-white">
                  Tasaciones
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="hover:text-white">
                  Asesoramiento
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Empresa</h3>
            <ul className="space-y-2 text-gray-400 dark:text-gray-500 transition-colors duration-300">
              <li>
                <Link href="/nosotros" className="hover:text-white">
                  Nosotros
                </Link>
              </li>
              <li>
                <Link href="/propiedades" className="hover:text-white">
                  Propiedades
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="hover:text-white">
                  Contacto
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Contacto</h3>
            <div className="space-y-2 text-gray-400 dark:text-gray-500 transition-colors duration-300">
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2" />
                +54 11 4000-0000
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                info@industrialpro.com.ar
              </div>
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2" />
                Buenos Aires, Argentina
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 dark:border-gray-700 mt-8 pt-8 text-center text-gray-400 dark:text-gray-500 transition-colors duration-300">
          <p>&copy; 2024 IndustrialPro. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
