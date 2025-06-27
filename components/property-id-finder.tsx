"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, ExternalLink, Copy, CheckCircle } from "lucide-react"
import Link from "next/link"

interface RealProperty {
  id: number
  title: string
  price: number
  currency: string
  location: string
  type: string
}

interface ApiResponse {
  success: boolean
  count: number
  properties: RealProperty[]
  message: string
}

export function PropertyIdFinder() {
  const [properties, setProperties] = useState<RealProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const fetchRealProperties = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/tokko/real-properties?limit=20")
      const data: ApiResponse = await response.json()

      if (data.success) {
        setProperties(data.properties)
      } else {
        console.error("Failed to fetch properties:", data)
      }
    } catch (error) {
      console.error("Error fetching properties:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyId = async (id: number) => {
    await navigator.clipboard.writeText(id.toString())
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Real Property ID Finder</span>
          </CardTitle>
          <p className="text-gray-600">
            Find real property IDs from TokkoBroker API to test your property detail pages.
          </p>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchRealProperties} disabled={loading}>
            {loading ? "Loading..." : "Fetch Real Property IDs"}
          </Button>
        </CardContent>
      </Card>

      {properties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Properties ({properties.length})</CardTitle>
            <p className="text-sm text-gray-600">
              Click on any property ID to test the detail page, or copy the ID for manual testing.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((property) => (
                <div key={property.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline">ID: {property.id}</Badge>
                    <button
                      onClick={() => copyId(property.id)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copy ID"
                    >
                      {copiedId === property.id ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <h3 className="font-semibold text-sm mb-2 line-clamp-2">{property.title}</h3>

                  <div className="text-xs text-gray-600 space-y-1 mb-3">
                    <div>📍 {property.location}</div>
                    <div>🏭 {property.type}</div>
                    <div>
                      💰 {property.currency} {property.price?.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" asChild className="flex-1">
                      <Link href={`/propiedades/${property.id}`}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild className="flex-1">
                      <Link href={`/api/tokko/property/${property.id}`} target="_blank">
                        API
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1. Get Real Property IDs</h4>
            <p className="text-sm text-gray-600">
              Click "Fetch Real Property IDs" above to get actual property IDs from your TokkoBroker API.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2. Test Property Details</h4>
            <p className="text-sm text-gray-600">
              Use the real property IDs to test your property detail pages. If a property doesn't exist, the system will
              gracefully fall back to mock data.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. API Endpoints</h4>
            <div className="text-xs space-y-1 font-mono bg-gray-100 p-2 rounded">
              <div>GET /api/tokko/property/[id] - Get specific property</div>
              <div>GET /api/tokko/real-properties - Get real property IDs</div>
              <div>GET /propiedades/[id] - Property detail page</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
