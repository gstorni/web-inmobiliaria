import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, Phone, Mail, Search } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { OurCustomers } from "@/components/our-customers"
import { StatisticsSection } from "@/components/statistics-section"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />

      {/* Featured Properties */}
      <FeaturedProperties />

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

function FeaturedProperties() {
  return (
    <section className="py-16 bg-white dark:bg-gray-900 transition-colors duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">
            Propiedades Destacadas
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto transition-colors duration-300">
            Descubrí nuestras mejores opciones en propiedades industriales, seleccionadas especialmente para tu negocio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="overflow-hidden hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
              <div className="relative h-48">
                <Image
                  src={`/placeholder.svg?height=200&width=400&query=industrial warehouse ${i}`}
                  alt={`Propiedad Industrial ${i}`}
                  fill
                  className="object-cover"
                />
                <Badge className="absolute top-4 left-4 bg-blue-600">Destacada</Badge>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2 transition-colors duration-300">
                  <MapPin className="h-4 w-4 mr-1" />
                  Zona Industrial Norte
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white transition-colors duration-300">
                  Galpón Industrial Premium
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 transition-colors duration-300">
                  Moderno galpón industrial de {2500 + i * 500} m² con oficinas administrativas, altura libre de 8m y
                  acceso para camiones.
                </p>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 transition-colors duration-300">
                    USD {(150000 + i * 50000).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
                    {2500 + i * 500} m²
                  </div>
                </div>
                <Button className="w-full" variant="outline" asChild>
                  <Link href={`/propiedades/${i}`}>Ver Detalles</Link>
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
