"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  RefreshCw,
  Database,
  Zap,
  TrendingUp,
  Activity,
  Brain,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
} from "lucide-react"

interface EnhancedStats {
  hitRates: {
    overall: number
    redis: number
    postgres: number
    searchCache: number
  }
  performance: {
    avgResponseTime: number
    totalRequests: number
    responseTimes: number[]
  }
  capacity: {
    redisSize: number
    redisCapacity: number
    redisUtilization: number
    searchCacheSize: number
  }
  patterns: {
    totalTracked: number
    topProperties: Array<{
      id: number
      frequency: number
      sessions: number
    }>
  }
  errors: {
    redis: number
    postgres: number
    api: number
  }
  redis: {
    connected: boolean
    configured: boolean
  }
  mode: string
}

interface SystemHealth {
  status: "healthy" | "warning" | "critical"
  score: number
  issues: string[]
  recommendations: string[]
}

export function EnhancedPerformanceDashboard() {
  const [stats, setStats] = useState<EnhancedStats | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warming, setWarming] = useState(false)

  const fetchStats = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [statsResponse, healthResponse] = await Promise.all([
        fetch("/api/cache/enhanced-stats"),
        fetch("/api/system/health"),
      ])

      if (!statsResponse.ok || !healthResponse.ok) {
        throw new Error("Failed to fetch dashboard data")
      }

      const statsData = await statsResponse.json()
      const healthData = await healthResponse.json()

      setStats(statsData.stats)
      setHealth(healthData.health)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const triggerPredictiveWarming = async () => {
    setWarming(true)
    try {
      const response = await fetch("/api/cache/predictive-warm", { method: "POST" })
      const data = await response.json()

      if (data.success) {
        alert(`Predictive warming completed: ${data.warmed} properties warmed`)
        fetchStats()
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      alert("Predictive warming failed: " + error.message)
    } finally {
      setWarming(false)
    }
  }

  const triggerOptimization = async () => {
    try {
      const response = await fetch("/api/system/optimize", { method: "POST" })
      const data = await response.json()

      if (data.success) {
        alert("System optimization completed")
        fetchStats()
      }
    } catch (error) {
      alert("Optimization failed: " + error.message)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600"
      case "warning":
        return "text-yellow-600"
      case "critical":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />
      case "warning":
        return <AlertTriangle className="h-4 w-4" />
      case "critical":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Enhanced Performance Dashboard</h2>
          <p className="text-muted-foreground">Real-time monitoring and intelligent caching analytics</p>
        </div>
        <Button onClick={fetchStats} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Health Overview */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getHealthIcon(health.status)}
              <span className={getHealthColor(health.status)}>System Health: {health.status.toUpperCase()}</span>
              <Badge variant="outline">Score: {health.score}/100</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={health.score} className="w-full" />

              {health.issues.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-600 mb-2">Issues Detected:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {health.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-red-600">
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {health.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-blue-600 mb-2">Recommendations:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {health.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-blue-600">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="caching">Caching</TabsTrigger>
          <TabsTrigger value="patterns">Access Patterns</TabsTrigger>
          <TabsTrigger value="scaling">Auto-Scaling</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.performance.avgResponseTime?.toFixed(1) || 0}ms</div>
                <p className="text-xs text-muted-foreground">Target: &lt;50ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.performance.totalRequests?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">All-time requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.hitRates.overall?.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">Combined cache efficiency</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats
                    ? (
                        ((stats.errors.redis + stats.errors.postgres + stats.errors.api) /
                          Math.max(stats.performance.totalRequests, 1)) *
                        100
                      ).toFixed(2)
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground">Target: &lt;1%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="caching" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Redis Cache (L1)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Status:</span>
                  <Badge variant={stats?.redis.connected ? "default" : "destructive"}>
                    {stats?.redis.connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Hit Rate:</span>
                  <span className="font-semibold">{stats?.hitRates.redis?.toFixed(1) || 0}%</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Capacity:</span>
                    <span>
                      {stats?.capacity.redisSize || 0}/{stats?.capacity.redisCapacity || 500}
                    </span>
                  </div>
                  <Progress value={stats?.capacity.redisUtilization || 0} />
                  <p className="text-xs text-muted-foreground">
                    {stats?.capacity.redisUtilization?.toFixed(1) || 0}% utilized
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  PostgreSQL Cache (L2)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Hit Rate:</span>
                  <span className="font-semibold">{stats?.hitRates.postgres?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Errors:</span>
                  <Badge variant={stats?.errors.postgres ? "destructive" : "default"}>
                    {stats?.errors.postgres || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Cache
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Hit Rate:</span>
                  <span className="font-semibold">{stats?.hitRates.searchCache?.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Cached Queries:</span>
                  <span>{stats?.capacity.searchCacheSize || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Access Patterns & Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Properties Tracked:</span>
                  <Badge variant="outline">{stats?.patterns.totalTracked || 0}</Badge>
                </div>

                {stats?.patterns.topProperties && stats.patterns.topProperties.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Most Accessed Properties:</h4>
                    <div className="space-y-2">
                      {stats.patterns.topProperties.slice(0, 5).map((property, index) => (
                        <div key={property.id} className="flex items-center justify-between p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <span>Property {property.id}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>{property.frequency.toFixed(1)} req/hr</span>
                            <span>{property.sessions} sessions</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scaling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Scaling Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertDescription>
                    Auto-scaling is monitoring system performance and will automatically optimize cache and database
                    performance based on real-time metrics.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Active Rules</h4>
                    <p className="text-2xl font-bold">4</p>
                    <p className="text-xs text-muted-foreground">Monitoring metrics</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Recent Actions</h4>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-muted-foreground">Last 24 hours</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Intelligent Cache Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={triggerPredictiveWarming} disabled={warming} className="w-full">
                  {warming ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Predictive Warming...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Trigger Predictive Warming
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Uses AI to predict and preload likely future requests based on access patterns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  System Optimization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={triggerOptimization} className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Optimize System Performance
                </Button>
                <p className="text-xs text-muted-foreground">
                  Runs comprehensive optimization including query tuning and cache optimization
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default EnhancedPerformanceDashboard
