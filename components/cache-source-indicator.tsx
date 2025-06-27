"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Zap, Database, Globe, Clock, TrendingUp, Activity } from "lucide-react"

interface CacheSourceProps {
  propertyId?: number
  showGlobalStats?: boolean
}

interface CacheMetrics {
  source: "redis" | "postgres" | "api" | "unknown"
  responseTime: number
  cached: boolean
  timestamp: string
  hitRate?: number
  totalRequests?: number
}

export function CacheSourceIndicator({ propertyId, showGlobalStats = false }: CacheSourceProps) {
  const [metrics, setMetrics] = useState<CacheMetrics | null>(null)
  const [globalStats, setGlobalStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (showGlobalStats) {
      fetchGlobalStats()
      const interval = setInterval(fetchGlobalStats, 5000) // Update every 5 seconds
      return () => clearInterval(interval)
    }
  }, [showGlobalStats])

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch("/api/cache/enhanced-stats")
      if (response.ok) {
        const data = await response.json()
        setGlobalStats(data.stats)
      }
    } catch (error) {
      console.warn("Failed to fetch global stats:", error)
    }
  }

  const testProperty = async (id: number) => {
    setIsLoading(true)
    try {
      const startTime = Date.now()
      const response = await fetch(`/api/properties/${id}`)
      const responseTime = Date.now() - startTime

      if (response.ok) {
        const data = await response.json()

        // Determine source based on response time and metadata
        let source: CacheMetrics["source"] = "unknown"
        if (data.meta?.cached || responseTime < 50) {
          source = "redis"
        } else if (responseTime < 200) {
          source = "postgres"
        } else {
          source = "api"
        }

        setMetrics({
          source,
          responseTime,
          cached: data.meta?.cached || false,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error("Failed to test property:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "redis":
        return <Zap className="h-4 w-4" />
      case "postgres":
        return <Database className="h-4 w-4" />
      case "api":
        return <Globe className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case "redis":
        return "bg-green-500 text-white"
      case "postgres":
        return "bg-blue-500 text-white"
      case "api":
        return "bg-orange-500 text-white"
      default:
        return "bg-gray-500 text-white"
    }
  }

  const getSourceName = (source: string) => {
    switch (source) {
      case "redis":
        return "Redis Cache"
      case "postgres":
        return "PostgreSQL"
      case "api":
        return "TokkoBroker API"
      default:
        return "Unknown"
    }
  }

  const getPerformanceColor = (time: number) => {
    if (time < 50) return "text-green-600"
    if (time < 200) return "text-blue-600"
    if (time < 500) return "text-orange-600"
    return "text-red-600"
  }

  return (
    <div className="space-y-4">
      {/* Property-specific testing */}
      {propertyId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Cache Source Test</h3>
              <button
                onClick={() => testProperty(propertyId)}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? "Testing..." : "Test Property"}
              </button>
            </div>

            {metrics && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={getSourceColor(metrics.source)}>
                    {getSourceIcon(metrics.source)}
                    <span className="ml-1">{getSourceName(metrics.source)}</span>
                  </Badge>
                  <Badge variant="outline" className={getPerformanceColor(metrics.responseTime)}>
                    <Clock className="h-3 w-3 mr-1" />
                    {metrics.responseTime}ms
                  </Badge>
                </div>

                <div className="text-sm text-gray-600">
                  <div>Property ID: {propertyId}</div>
                  <div>Cached: {metrics.cached ? "✅ Yes" : "❌ No"}</div>
                  <div>Tested: {new Date(metrics.timestamp).toLocaleTimeString()}</div>
                </div>

                <div className="text-xs bg-gray-50 p-2 rounded">
                  <strong>How to interpret:</strong>
                  <ul className="mt-1 space-y-1">
                    <li>🟢 &lt;50ms = Redis Cache (fastest)</li>
                    <li>🔵 50-200ms = PostgreSQL (fast)</li>
                    <li>🟠 200-500ms = API Call (slower)</li>
                    <li>🔴 &gt;500ms = Slow API/Network issues</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Global statistics */}
      {showGlobalStats && globalStats && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-semibold">Live Cache Performance</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Redis Stats */}
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">Redis</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{globalStats.hitRates?.redis?.toFixed(1) || 0}%</div>
                <div className="text-sm text-green-700">
                  {globalStats.redis?.hits || 0} hits / {globalStats.redis?.hits + globalStats.redis?.misses || 0}{" "}
                  requests
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {globalStats.capacity?.redisSize || 0} / {globalStats.capacity?.redisCapacity || 0} cached
                </div>
              </div>

              {/* PostgreSQL Stats */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">PostgreSQL</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {globalStats.hitRates?.postgres?.toFixed(1) || 0}%
                </div>
                <div className="text-sm text-blue-700">Database queries</div>
              </div>

              {/* API Stats */}
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-800">API Calls</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">{globalStats.errors?.api || 0}</div>
                <div className="text-sm text-orange-700">TokkoBroker calls</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Avg Response Time:</span>
                <span className={getPerformanceColor(globalStats.performance?.avgResponseTime || 0)}>
                  {globalStats.performance?.avgResponseTime?.toFixed(0) || 0}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Requests:</span>
                <span>{globalStats.performance?.totalRequests || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Cache Mode:</span>
                <span className="capitalize">{globalStats.mode || "unknown"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
