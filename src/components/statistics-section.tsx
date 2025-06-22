"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Building, TrendingUp, Users, Award, MapPin, Clock } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

export function StatisticsSection() {
  const { theme } = useTheme()

  const stats = [
    {
      number: "500+",
      label: "Propiedades Disponibles",
      icon: Building,
      description: "En nuestro portfolio activo",
    },
    {
      number: "15+",
      label: "Años de Experiencia",
      icon: TrendingUp,
      description: "En el mercado inmobiliario",
    },
    {
      number: "1000+",
      label: "Clientes Satisfechos",
      icon: Users,
      description: "Que confían en nosotros",
    },
    {
      number: "50+",
      label: "Zonas Industriales",
      icon: MapPin,
      description: "Cubrimos toda la región",
    },
    {
      number: "24/7",
      label: "Atención al Cliente",
      icon: Clock,
      description: "Soporte continuo",
    },
    {
      number: "98%",
      label: "Tasa de Éxito",
      icon: Award,
      description: "En transacciones cerradas",
    },
  ]

  return (
    <section className={`py-16 transition-colors duration-300 ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className={`text-3xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Nuestros Números
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
            Cifras que demuestran nuestro compromiso y liderazgo en el sector inmobiliario industrial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className={`text-center transition-all duration-300 hover:shadow-lg group ${
                theme === "dark"
                  ? "bg-gray-900 border-gray-700 hover:bg-gray-850"
                  : "bg-gray-50 border-gray-200 hover:shadow-xl"
              }`}
            >
              <CardContent className="p-8">
                <div className="flex items-center justify-center mb-4">
                  <div
                    className={`p-4 rounded-full transition-colors duration-300 ${
                      theme === "dark" ? "bg-orange-500/20" : "bg-orange-100"
                    }`}
                  >
                    <stat.icon
                      className={`h-8 w-8 ${
                        theme === "dark" ? "text-orange-400" : "text-orange-600"
                      } group-hover:scale-110 transition-transform`}
                    />
                  </div>
                </div>
                <div
                  className={`text-4xl font-bold mb-2 ${
                    theme === "dark" ? "text-white" : "text-gray-900"
                  } group-hover:text-orange-500 transition-colors`}
                >
                  {stat.number}
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {stat.label}
                </h3>
                <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
