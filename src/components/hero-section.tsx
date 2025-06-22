"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

export function HeroSection() {
  const [searchQuery, setSearchQuery] = useState("")
  const { theme, isTransitioning } = useTheme()

  const handleSearch = () => {
    if (searchQuery.trim()) {
      window.location.href = `/propiedades?q=${encodeURIComponent(searchQuery.trim())}`
    } else {
      window.location.href = "/propiedades"
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  return (
    <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {/* Background Images with Smooth Transition */}
      <div className="absolute inset-0">
        {/* Day Background */}
        <div
          className={`
            absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out
            ${theme === "light" && !isTransitioning ? "opacity-100" : "opacity-0"}
          `}
          style={{
            backgroundImage: "url('/images/hero-day-background.webp')",
          }}
        />

        {/* Night Background */}
        <div
          className={`
            absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out
            ${theme === "dark" && !isTransitioning ? "opacity-100" : "opacity-0"}
          `}
          style={{
            backgroundImage: "url('/images/hero-night-background.webp')",
          }}
        />

        {/* Overlay for text readability */}
        <div
          className={`absolute inset-0 transition-all duration-700 ${
            theme === "dark"
              ? "bg-gradient-to-b from-black/70 via-black/50 to-black/80"
              : "bg-gradient-to-b from-black/30 via-black/10 to-black/40"
          }`}
        ></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 lg:pt-24">
        <div className="text-center mb-12 lg:mb-16">
          {/* Main Heading - Updated Text */}
          <div className="mb-8 lg:mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6 leading-tight tracking-tight uppercase">
              Tu Espacio Industrial,
              <br />
              <span className="text-orange-500 drop-shadow-lg">Nuestra Estrategia Comercial</span>
            </h1>
          </div>

          {/* Enhanced Stats */}

          {/* Inline Search Bar */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-transparent backdrop-blur-md border-2 border-white/30 rounded-2xl p-4 lg:p-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Buscar propiedades industriales... (ej: galpón zona norte, depósito logístico)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full h-14 lg:h-16 px-6 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white/90 backdrop-blur-sm"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  size="lg"
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 lg:px-12 h-14 lg:h-16 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group whitespace-nowrap"
                >
                  <Search className="mr-2 h-5 w-5 lg:h-6 lg:w-6 group-hover:scale-110 transition-transform" />
                  Buscar
                </Button>
              </div>

              {/* Quick Search Suggestions */}
            </div>
          </div>

          {/* Call to Action */}
        </div>

        {/* Enhanced Scroll Indicator */}
        <div className="text-center mt-16 lg:mt-20">
          <div className="inline-flex flex-col items-center text-white/70 animate-bounce">
            <span className="text-sm font-semibold mb-3 tracking-wide">Explorá más</span>
            <div className="w-6 h-12 border-2 border-white/50 rounded-full flex justify-center">
              <div className="w-1.5 h-4 bg-white/70 rounded-full mt-2 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
