import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, ArrowLeft, Search } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <CardTitle className="text-2xl">Propiedad no encontrada</CardTitle>
          <p className="text-gray-600">La propiedad que buscas no existe o ha sido removida.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" asChild>
            <Link href="/propiedades">
              <Search className="h-4 w-4 mr-2" />
              Ver todas las propiedades
            </Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al inicio
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
