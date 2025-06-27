"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Activity,
  Database,
  Zap,
  Globe,
  RefreshCw,
  Trash2,
  Target,
  Flame,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react"

interface CacheMetrics {
  redis: {
    hits: number
    misses: number
    errors: number
    totalRequests: number
    avgResponseTime: number
    lastError?: string
    lastErrorTime?: string
  }
  neon: {
    hits: number
    misses: number
    errors: number
    totalRequests: number
    avgResponseTime: number
    lastError?: string
    lastErrorTime?: string
  }
  api: {
    calls: number
    errors: number
    totalRequests: number
    avgResponseTime: number
    lastError?: string
    lastErrorTime?: string
  }
  overall: {
    totalRequests: number
    cacheHitRate: number
    avgResponseTime: number
    uptime: number
  }
}

interface ConnectionStatus {
  redis: boolean
  neon: boolean
  overall: "optimal" | "degraded" | "critical"
}

export default function CacheManagementDashboard() {
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [propertyIdToInvalidate, setPropertyIdToInvalidate] = useState("")
  const [warmCacheLimit, setWarmCacheLimit] = useState("50")
  const [operationLoading, setOperationLoading] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchData = async () => {
    try {
      const [metricsRes, statusRes] = await Promise.all([
        fetch("/api/cache/enhanced-metrics"),
        fetch("/api/cache/connection-status"),
      ])

      if (metricsRes.ok && statusRes.ok) {
        const metricsData = await metricsRes.json()
        const statusData = await statusRes.json()

        setMetrics(metricsData)
        setConnectionStatus(statusData)
        setError(null)
      } else {
        throw new Error("Failed to fetch cache data")
      }
    } catch (err: any) {
      setError(err.message)
      console.error("Failed to fetch cache data:", err)
    } finally {
      setLoading(false)
      setLastUpdate(new Date())
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const handleClearRedisCache = async () => {
    if (!confirm("Are you sure you want to clear the entire Redis cache?")) return

    setOperationLoading("clear-redis")
    try {
      const response = await fetch("/api/cache/clear-redis", { method: "POST" })
      const result = await response.json()

      if (result.success) {
        alert(`✅ ${result.message}`)
        fetchData()
      } else {
        alert(`❌ ${result.message}`)
      }
    } catch (error: any) {
      alert(`❌ Failed to clear Redis cache: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const handleInvalidateProperty = async () => {
    if (!propertyIdToInvalidate.trim()) {
      alert("Please enter a property ID")
      return
    }

    setOperationLoading("invalidate")
    try {
      const response = await fetch("/api/cache/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: propertyIdToInvalidate }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`✅ ${result.message}`)
        setPropertyIdToInvalidate("")
        fetchData()
      } else {
        alert(`❌ ${result.message}`)
      }
    } catch (error: any) {
      alert(`❌ Failed to invalidate property: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const handleWarmCache = async () => {
    setOperationLoading("warm")
    try {
      const response = await fetch("/api/cache/warm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: Number.parseInt(warmCacheLimit) }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`🔥 ${result.message}`)
        fetchData()
      } else {
        alert(`❌ ${result.message}`)
      }
    } catch (error: any) {
      alert(`❌ Failed to warm cache: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal":
        return "text-green-600"
      case "degraded":
        return "text-yellow-600"
      case "critical":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getStatusIcon = (connected: boolean) => {
    return connected ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading cache dashboard...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load cache dashboard: {error}</AlertDescription>
        </Alert>
        <Button onClick={fetchData} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cache Management Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage hybrid cache performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          </Badge>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-red-500" />
                <span className="font-medium">Redis Cache</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionStatus?.redis || false)}
                <span className={connectionStatus?.redis ? "text-green-600" : "text-red-600"}>
                  {connectionStatus?.redis ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Neon Database</span>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(connectionStatus?.neon || false)}
                <span className={connectionStatus?.neon ? "text-green-600" : "text-red-600"}>
                  {connectionStatus?.neon ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Overall Status</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(connectionStatus?.overall || "critical")}>
                  {connectionStatus?.overall?.toUpperCase() || "UNKNOWN"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Redis Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Zap className="h-4 w-4 text-red-500" />
              <span>Redis Cache</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Hit Rate</span>
                <span className="font-medium">
                  {metrics?.redis.totalRequests > 0
                    ? Math.round((metrics.redis.hits / metrics.redis.totalRequests) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={metrics?.redis.totalRequests > 0 ? (metrics.redis.hits / metrics.redis.totalRequests) * 100 : 0}
                className="h-2"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Hits: {metrics?.redis.hits || 0}</div>
                <div>Misses: {metrics?.redis.misses || 0}</div>
                <div>Errors: {metrics?.redis.errors || 0}</div>
                <div>Avg: {Math.round(metrics?.redis.avgResponseTime || 0)}ms</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Neon Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Database className="h-4 w-4 text-blue-500" />
              <span>Neon Database</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Hit Rate</span>
                <span className="font-medium">
                  {metrics?.neon.totalRequests > 0
                    ? Math.round((metrics.neon.hits / metrics.neon.totalRequests) * 100)
                    : 0}
                  %
                </span>
              </div>
              <Progress
                value={metrics?.neon.totalRequests > 0 ? (metrics.neon.hits / metrics.neon.totalRequests) * 100 : 0}
                className="h-2"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Hits: {metrics?.neon.hits || 0}</div>
                <div>Misses: {metrics?.neon.misses || 0}</div>
                <div>Errors: {metrics?.neon.errors || 0}</div>
                <div>Avg: {Math.round(metrics?.neon.avgResponseTime || 0)}ms</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <Globe className="h-4 w-4 text-green-500" />
              <span>API Calls</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Success Rate</span>
                <span className="font-medium">
                  {metrics?.api.totalRequests > 0
                    ? Math.round(((metrics.api.totalRequests - metrics.api.errors) / metrics.api.totalRequests) * 100)
                    : 100}
                  %
                </span>
              </div>
              <Progress
                value={
                  metrics?.api.totalRequests > 0
                    ? ((metrics.api.totalRequests - metrics.api.errors) / metrics.api.totalRequests) * 100
                    : 100
                }
                className="h-2"
              />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Calls: {metrics?.api.calls || 0}</div>
                <div>Errors: {metrics?.api.errors || 0}</div>
                <div>Avg: {Math.round(metrics?.api.avgResponseTime || 0)}ms</div>
                <div>Total: {metrics?.api.totalRequests || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span>Overall Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cache Hit Rate</span>
                <span className="font-medium">{Math.round(metrics?.overall.cacheHitRate || 0)}%</span>
              </div>
              <Progress value={metrics?.overall.cacheHitRate || 0} className="h-2" />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Requests: {metrics?.overall.totalRequests || 0}</div>
                <div>Avg: {Math.round(metrics?.overall.avgResponseTime || 0)}ms</div>
                <div>Uptime: {formatUptime(metrics?.overall.uptime || 0)}</div>
                <div></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Management Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Management Operations</CardTitle>
          <CardDescription>Manage cache entries and performance optimization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Clear Redis Cache */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Clear Redis Cache</Label>
              <p className="text-xs text-muted-foreground">Remove all cached properties from Redis</p>
              <Button
                onClick={handleClearRedisCache}
                disabled={operationLoading === "clear-redis"}
                variant="destructive"
                className="w-full"
              >
                {operationLoading === "clear-redis" ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Clear Redis
              </Button>
            </div>

            {/* Invalidate Property */}
            <div className="space-y-2">
              <Label htmlFor="propertyId" className="text-sm font-medium">
                Invalidate Property
              </Label>
              <p className="text-xs text-muted-foreground">Remove specific property from all cache tiers</p>
              <div className="flex space-x-2">
                <Input
                  id="propertyId"
                  placeholder="Property ID"
                  value={propertyIdToInvalidate}
                  onChange={(e) => setPropertyIdToInvalidate(e.target.value)}
                />
                <Button
                  onClick={handleInvalidateProperty}
                  disabled={operationLoading === "invalidate"}
                  variant="outline"
                >
                  {operationLoading === "invalidate" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Warm Cache */}
            <div className="space-y-2">
              <Label htmlFor="warmLimit" className="text-sm font-medium">
                Warm Cache
              </Label>
              <p className="text-xs text-muted-foreground">Preload hot properties into Redis cache</p>
              <div className="flex space-x-2">
                <Input
                  id="warmLimit"
                  placeholder="Limit"
                  value={warmCacheLimit}
                  onChange={(e) => setWarmCacheLimit(e.target.value)}
                  type="number"
                />
                <Button onClick={handleWarmCache} disabled={operationLoading === "warm"} variant="outline">
                  {operationLoading === "warm" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Flame className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Logs */}
      {(metrics?.redis.lastError || metrics?.neon.lastError || metrics?.api.lastError) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span>Recent Errors</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics?.redis.lastError && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Redis:</strong> {metrics.redis.lastError}
                    {metrics.redis.lastErrorTime && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({new Date(metrics.redis.lastErrorTime).toLocaleString()})
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {metrics?.neon.lastError && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Neon:</strong> {metrics.neon.lastError}
                    {metrics.neon.lastErrorTime && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({new Date(metrics.neon.lastErrorTime).toLocaleString()})
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {metrics?.api.lastError && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>API:</strong> {metrics.api.lastError}
                    {metrics.api.lastErrorTime && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({new Date(metrics.api.lastErrorTime).toLocaleString()})
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!metrics?.redis.lastError && !metrics?.neon.lastError && !metrics?.api.lastError && (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <div className="text-lg font-semibold">No Recent Errors</div>
            <div className="text-gray-600">All cache tiers are operating normally</div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
