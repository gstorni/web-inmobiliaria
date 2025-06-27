"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Star, Quote } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"
import Image from "next/image"

export function OurCustomers() {
  const { theme } = useTheme()

  const testimonials = [
    {
      name: "Carlos Mendoza",
      company: "Logística del Sur S.A.",
      text: "IndustrialPro nos ayudó a encontrar el galpón perfecto para nuestras operaciones. Su conocimiento del mercado es excepcional.",
      rating: 5,
      image: "/placeholder.svg?height=80&width=80",
    },
    {
      name: "María González",
      company: "Manufacturas Norte",
      text: "Excelente servicio y asesoramiento. Nos acompañaron en todo el proceso de compra de nuestra nueva planta industrial.",
      rating: 5,
      image: "/placeholder.svg?height=80&width=80",
    },
    {
      name: "Roberto Silva",
      company: "Distribuidora Central",
      text: "Profesionales serios y comprometidos. Encontramos exactamente lo que necesitábamos en tiempo récord.",
      rating: 5,
      image: "/placeholder.svg?height=80&width=80",
    },
  ]

  const clientLogos = [
    { name: "TechCorp", logo: "/placeholder.svg?height=60&width=120" },
    { name: "LogiFlow", logo: "/placeholder.svg?height=60&width=120" },
    { name: "IndustrialMax", logo: "/placeholder.svg?height=60&width=120" },
    { name: "GlobalTrade", logo: "/placeholder.svg?height=60&width=120" },
    { name: "ManufactureX", logo: "/placeholder.svg?height=60&width=120" },
    { name: "SupplyChain", logo: "/placeholder.svg?height=60&width=120" },
  ]

  return (
    <section className={`py-16 transition-colors duration-300 ${theme === "dark" ? "bg-gray-900" : "bg-gray-50"}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className={`text-3xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Nuestros Clientes
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
            La confianza de empresas líderes respalda nuestro compromiso con la excelencia en el sector inmobiliario
            industrial.
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className={`transition-all duration-300 hover:shadow-lg ${
                theme === "dark"
                  ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                  : "bg-white border-gray-200 hover:shadow-xl"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  <Quote className={`h-8 w-8 mr-3 ${theme === "dark" ? "text-orange-400" : "text-orange-500"}`} />
                  <div className="flex">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 fill-current ${theme === "dark" ? "text-yellow-400" : "text-yellow-500"}`}
                      />
                    ))}
                  </div>
                </div>
                <p className={`mb-6 italic ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                  &ldquo;{testimonial.text}&rdquo;
                </p>
                <div className="flex items-center">
                  <Image
                    src={testimonial.image || "/placeholder.svg"}
                    alt={testimonial.name}
                    width={50}
                    height={50}
                    className="rounded-full mr-4"
                  />
                  <div>
                    <h4 className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                      {testimonial.name}
                    </h4>
                    <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                      {testimonial.company}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Client Logos */}
        <div className="text-center">
          <h3 className={`text-xl font-semibold mb-8 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Empresas que confían en nosotros
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
            {clientLogos.map((client, index) => (
              <div
                key={index}
                className={`flex items-center justify-center p-4 rounded-lg transition-all duration-300 ${
                  theme === "dark"
                    ? "bg-gray-800 hover:bg-gray-700 border border-gray-700"
                    : "bg-white hover:bg-gray-50 border border-gray-200"
                }`}
              >
                <Image
                  src={client.logo || "/placeholder.svg"}
                  alt={client.name}
                  width={120}
                  height={60}
                  className={`max-w-full h-auto ${theme === "dark" ? "filter brightness-90" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
