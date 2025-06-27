"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Database, ImageIcon, Clock, TrendingUp, Zap } from "lucide-react"
import { CacheControlPanel } from "./cache-control-panel"

interface CacheStats {
  totalProperties: number
  featuredProperties: number
  lastSyncTime: string | null
  pendingImages: number
  processedImages: number
}

export function CacheDashboard() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [processingImages, setProcessingImages] = useState(false)

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/properties/cache-stats")
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch cache stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const syncProperties = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/properties/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      })
      const data = await response.json()

      if (data.success) {
        alert(`Sync completed: ${data.synced} properties synced, ${data.errors} errors`)
        fetchStats()
      } else {
        alert(`Sync failed: ${data.message}`)
      }
    } catch (error) {
      alert("Sync failed: Network error")
    } finally {
      setSyncing(false)
    }
  }

  const processImages = async () => {
    setProcessingImages(true)
    try {
      const response = await fetch("/api/images/process", {
        method: "POST",
      })
      const data = await response.json()

      if (data.success) {
        alert(`Image processing completed: ${data.processed} images processed, ${data.errors} errors`)
        fetchStats()
      } else {
        alert(`Image processing failed: ${data.message}`)
      }
    } catch (error) {
      alert("Image processing failed: Network error")
    } finally {
      setProcessingImages(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-300 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cache Dashboard</h2>
        <div className="flex gap-2">
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={syncProperties} disabled={syncing}>
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Sync Properties
              </>
            )}
          </Button>
          <Button onClick={processImages} disabled={processingImages} variant="outline">
            {processingImages ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4 mr-2" />
                Process Images
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProperties.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Cached in Supabase</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Featured Properties</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.featuredProperties.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalProperties
                ? `${((stats.featuredProperties / stats.totalProperties) * 100).toFixed(1)}% of total`
                : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Processing</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processedImages.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pendingImages ? (
                <Badge variant="secondary" className="text-xs">
                  {stats.pendingImages} pending
                </Badge>
              ) : (
                "All processed"
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.lastSyncTime ? (
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              ) : (
                "Never"
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleString() : "No sync performed"}
            </p>
          </CardContent>
        </Card>
      </div>

      <CacheControlPanel />

      <Card>
        <CardHeader>
          <CardTitle>Cache Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Search Speed</span>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                <Zap className="h-3 w-3 mr-1" />
                ~50ms avg
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Image Optimization</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                WebP + AVIF formats
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Full-text Search</span>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                PostgreSQL + Spanish
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
