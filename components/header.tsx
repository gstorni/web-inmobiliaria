"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, Phone } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "./theme-toggle"
import { LogoAM } from "./logoam"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navItems = [
    { href: "/propiedades", label: "Propiedades" },
    { href: "/servicios", label: "Servicios" },
    { href: "/nosotros", label: "Nosotros" },
    { href: "/contacto", label: "Contacto" },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-black/80 backdrop-blur-md shadow-lg" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="group">
            <LogoAM />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-white font-medium text-lg hover:text-white/80 transition-colors relative group"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-white transition-all group-hover:w-full"></span>
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            <ThemeToggle />
            <div className="flex items-center space-x-3 text-white">
              <Phone className="h-4 w-4" />
              <span className="font-medium">+54 11 4000-0000</span>
            </div>
            <Button
              className="bg-orange-500 text-white hover:bg-orange-600 font-semibold px-6 py-2 text-lg border border-white/20"
              asChild
            >
              <Link href="/contacto">Consultar</Link>
            </Button>
          </div>

          {/* Mobile Actions */}
          <div className="lg:hidden flex items-center space-x-2">
            <ThemeToggle />
            <button
              className="p-2 text-white hover:text-white/80 transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/10">
            <nav className="container mx-auto px-4 py-4">
              <div className="flex flex-col space-y-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-white font-medium text-lg py-2 hover:text-white/80 transition-colors border-b border-white/10 last:border-b-0"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="pt-4 space-y-3">
                  <div className="flex items-center space-x-2 text-white">
                    <Phone className="h-4 w-4" />
                    <span className="font-medium">+54 11 4000-0000</span>
                  </div>
                  <Button
                    className="w-full bg-orange-500 text-white hover:bg-orange-600 font-semibold py-3 text-lg"
                    asChild
                  >
                    <Link href="/contacto" onClick={() => setIsMobileMenuOpen(false)}>
                      Consultar Ahora
                    </Link>
                  </Button>
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
