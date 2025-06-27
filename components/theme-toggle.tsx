"use client"

import { Sun, Moon } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

export function ThemeToggle() {
  const { theme, toggleTheme, isTransitioning } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      disabled={isTransitioning}
      className={`
        relative p-2 rounded-full transition-all duration-300 
        ${isTransitioning ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"}
        focus:outline-none focus:ring-2 focus:ring-white/20
      `}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <div className="relative w-6 h-6">
        <Sun
          className={`
            absolute inset-0 h-6 w-6 text-white transition-all duration-300
            ${theme === "light" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"}
          `}
        />
        <Moon
          className={`
            absolute inset-0 h-6 w-6 text-white transition-all duration-300
            ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}
          `}
        />
      </div>
    </button>
  )
}
