"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, Database, Zap, TrendingUp, Clock, ImageIcon, Settings } from "lucide-react"

interface CacheStats {
  neon: {
    total_properties: number
    featured_properties: number
    processed_images: number
    pending_images: number
    redis_cached_properties: number
    avg_heat_score: number
  }
  redis: {
    connected: boolean
    keys: number
    memory: string
    hitRate: number
  }
  performance: {
    [key: string]: {
      avgResponseTime: number
      totalRequests: number
      hits: number
      misses: number
      errors: number
      hitRate: number
    }
  }
}

export function NeonCacheDashboard() {
  const [stats, setStats] = useState<CacheStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = async () => {
    try {
      setRefreshing(true)
      const response = await fetch("/api/cache/neon-stats")
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch cache stats:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const optimizeCache = async () => {
    try {
      const response = await fetch("/api/cache/optimize", { method: "POST" })
      const data = await response.json()
      if (data.success) {
        alert("Cache optimization completed successfully")
        fetchStats()
      }
    } catch (error) {
      alert("Cache optimization failed")
    }
  }

  const processImages = async () => {
    try {
      const response = await fetch("/api/images/process-neon", { method: "POST" })
      const data = await response.json()
      if (data.success) {
        alert(`Image processing completed: ${data.processed} processed, ${data.errors} errors`)
        fetchStats()
      }
    } catch (error) {
      alert("Image processing failed")
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Enhanced Multi-Tier Cache Dashboard</h2>
        <div className="flex gap-2">
          <Button onClick={fetchStats} variant="outline" size="sm" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={optimizeCache} variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Optimize
          </Button>
          <Button onClick={processImages} size="sm">
            <ImageIcon className="h-4 w-4 mr-2" />
            Process Images
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="redis">Redis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.neon.total_properties?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Cached in Neon</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hot Properties</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.neon.redis_cached_properties?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Cached in Redis (Heat: {stats?.neon.avg_heat_score?.toFixed(1) || "0"})
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Featured Properties</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.neon.featured_properties?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.neon.total_properties
                    ? `${((stats.neon.featured_properties / stats.neon.total_properties) * 100).toFixed(1)}% of total`
                    : "No data"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Optimized Images</CardTitle>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.neon.processed_images?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.neon.pending_images ? (
                    <Badge variant="secondary" className="text-xs">
                      {stats.neon.pending_images} pending
                    </Badge>
                  ) : (
                    "All processed"
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cache Architecture</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Tier 1: Redis (Hot Data)</span>
                  </div>
                  <Badge variant="outline" className="bg-red-50 text-red-700">
                    Sub-millisecond access
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Tier 2: Neon (Primary Cache)</span>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    ~10-50ms access
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Tier 3: Tokko API (Fallback)</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    500ms+ access
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats?.performance &&
              Object.entries(stats.performance).map(([layer, metrics]) => (
                <Card key={layer}>
                  <CardHeader>
                    <CardTitle className="capitalize">{layer} Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Hit Rate</span>
                      <div className="flex items-center space-x-2">
                        <Progress value={metrics.hitRate} className="w-16" />
                        <span className="text-sm font-medium">{metrics.hitRate.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Avg Response</span>
                      <Badge variant="outline">{metrics.avgResponseTime}ms</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Total Requests</span>
                      <span className="text-sm font-medium">{metrics.totalRequests.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Errors</span>
                      <Badge variant={metrics.errors > 0 ? "destructive" : "outline"}>{metrics.errors}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="images" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Image Processing Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Processed Images</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {stats?.neon.processed_images?.toLocaleString() || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pending Images</span>
                    <Badge variant={stats?.neon.pending_images ? "secondary" : "outline"}>
                      {stats?.neon.pending_images?.toLocaleString() || 0}
                    </Badge>
                  </div>
                  {stats?.neon.pending_images && stats.neon.pending_images > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Processing Progress</span>
                        <span>
                          {stats.neon.processed_images} / {stats.neon.processed_images + stats.neon.pending_images}
                        </span>
                      </div>
                      <Progress
                        value={
                          (stats.neon.processed_images / (stats.neon.processed_images + stats.neon.pending_images)) *
                          100
                        }
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Image Optimization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">WebP Format</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      ~30% smaller
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AVIF Format</span>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700">
                      ~50% smaller
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Thumbnails</span>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">
                      300px width
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Storage</span>
                    <Badge variant="outline">Neon Database</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="redis" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Redis Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Connection</span>
                    <Badge variant={stats?.redis.connected ? "outline" : "destructive"}>
                      {stats?.redis.connected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cached Keys</span>
                    <span className="text-sm font-medium">{stats?.redis.keys?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Memory Usage</span>
                    <Badge variant="outline">{stats?.redis.memory || "0B"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Hit Rate</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={stats?.redis.hitRate || 0} className="w-16" />
                      <span className="text-sm font-medium">{stats?.redis.hitRate?.toFixed(1) || 0}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hot Property Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Heat Threshold</span>
                    <Badge variant="outline">Score ≥ 10</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Eviction Policy</span>
                    <Badge variant="outline">LRU (Least Recently Used)</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">TTL</span>
                    <Badge variant="outline">1 hour</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto Promotion</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Enabled
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
