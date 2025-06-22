import type React from "react"
import type { Metadata } from "next"
import { Host_Grotesk } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/contexts/theme-context"

const hostGrotesk = Host_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "IndustrialPro - Propiedades Industriales",
  description: "Tu espacio industrial, nuestra estrategia comercial",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${hostGrotesk.className} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
