"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Database, Zap, Settings, RefreshCw } from "lucide-react"

interface CacheControlState {
  hybridCacheEnabled: boolean
  redisEnabled: boolean
  postgresEnabled: boolean
  mode: string
}

export function CacheControlPanel() {
  const [cacheState, setCacheState] = useState<CacheControlState>({
    hybridCacheEnabled: true,
    redisEnabled: true,
    postgresEnabled: true,
    mode: "hybrid",
  })
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>("")

  const fetchCacheState = async () => {
    try {
      const response = await fetch("/api/cache/status")
      const data = await response.json()

      if (data.success) {
        setCacheState(data.state)
        setLastUpdate(new Date().toLocaleTimeString())
      }
    } catch (error) {
      console.error("Failed to fetch cache state:", error)
    }
  }

  const toggleHybridCache = async (enabled: boolean) => {
    setLoading(true)
    try {
      const response = await fetch("/api/cache/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: enabled ? "enable" : "disable",
          component: "hybrid",
        }),
      })

      const data = await response.json()

      if (data.success) {
        setCacheState((prev) => ({
          ...prev,
          hybridCacheEnabled: enabled,
          mode: enabled ? "hybrid" : "postgresql-only",
        }))
        alert(`Hybrid cache ${enabled ? "enabled" : "disabled"} successfully`)
      } else {
        alert(`Failed to ${enabled ? "enable" : "disable"} hybrid cache: ${data.message}`)
      }
    } catch (error) {
      alert("Network error while toggling cache")
    } finally {
      setLoading(false)
    }
  }

  const clearAllCaches = async () => {
    if (!confirm("Are you sure you want to clear all caches? This will temporarily slow down the application.")) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/cache/clear-all", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        alert(`All caches cleared successfully: ${data.message}`)
        fetchCacheState()
      } else {
        alert(`Failed to clear caches: ${data.message}`)
      }
    } catch (error) {
      alert("Network error while clearing caches")
    } finally {
      setLoading(false)
    }
  }

  const forceWarmCache = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/cache/warm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`Cache warming completed: ${data.message}`)
        fetchCacheState()
      } else {
        alert(`Cache warming failed: ${data.message}`)
      }
    } catch (error) {
      alert("Network error while warming cache")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCacheState()
    const interval = setInterval(fetchCacheState, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "hybrid":
        return "bg-green-100 text-green-800"
      case "redis-limited":
        return "bg-yellow-100 text-yellow-800"
      case "postgresql-only":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "hybrid":
        return <Zap className="h-4 w-4" />
      case "redis-limited":
        return <AlertTriangle className="h-4 w-4" />
      case "postgresql-only":
        return <Database className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Cache Control Panel
          {lastUpdate && <span className="text-sm font-normal text-gray-500">(Updated: {lastUpdate})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Mode Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Current Mode:</span>
            <Badge className={getModeColor(cacheState.mode)}>
              {getModeIcon(cacheState.mode)}
              <span className="ml-1 capitalize">{cacheState.mode.replace("-", " ")}</span>
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCacheState} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Hybrid Cache Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-1">
            <div className="font-medium">Hybrid Cache System</div>
            <div className="text-sm text-gray-600">
              Enable/disable the entire hybrid caching system (Redis + PostgreSQL)
            </div>
          </div>
          <Switch checked={cacheState.hybridCacheEnabled} onCheckedChange={toggleHybridCache} disabled={loading} />
        </div>

        {/* Component Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4" />
              <span className="font-medium">Redis Cache</span>
            </div>
            <Badge variant={cacheState.redisEnabled ? "default" : "secondary"}>
              {cacheState.redisEnabled ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4" />
              <span className="font-medium">PostgreSQL Cache</span>
            </div>
            <Badge variant={cacheState.postgresEnabled ? "default" : "secondary"}>
              {cacheState.postgresEnabled ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Control Actions */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant="destructive" onClick={clearAllCaches} disabled={loading} className="flex-1">
              Clear All Caches
            </Button>
            <Button variant="outline" onClick={forceWarmCache} disabled={loading} className="flex-1">
              Force Warm Cache
            </Button>
          </div>

          {!cacheState.hybridCacheEnabled && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Cache Disabled</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                The hybrid cache is currently disabled. All requests will go directly to the database, which may result
                in slower response times.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
