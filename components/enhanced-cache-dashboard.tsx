"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RefreshCw, Zap, AlertCircle, Play, ListChecks } from "lucide-react"
import { Progress } from "@/components/ui/progress" // Assuming you have this shadcn component

interface SyncStatus {
  processId?: string
  type?: string
  status?: string
  progress?: number
  message?: string
  processedItems?: number
  totalItems?: number
  error?: string
}

export function EnhancedCacheDashboard() {
  const [cacheStats, setCacheStats] = useState(null)
  const [hybridPerfStats, setHybridPerfStats] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [syncLimit, setSyncLimit] = useState(50) // Default for property sync
  const [imageProcessLimit, setImageProcessLimit] = useState(20) // Default for image processing batches

  const [activeSyncs, setActiveSyncs] = useState<Record<string, SyncStatus>>({})

  const fetchBackendStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Consolidate fetching: /api/properties/cache-stats now includes performance details
      const [cacheOverviewRes, activeProcessesRes] = await Promise.all([
        fetch("/api/properties/cache-stats"),
        fetch("/api/checkpoints/active"),
      ])

      if (!cacheOverviewRes.ok) throw new Error(`Cache Overview HTTP error! status: ${cacheOverviewRes.status}`)
      const overviewData = await cacheOverviewRes.json()

      if (overviewData.success) {
        setCacheStats(overviewData) // Contains all overview stats
        if (overviewData.performanceDetails) {
          setHybridPerfStats(overviewData.performanceDetails) // Contains performance stats
        } else {
          // Set a default or empty structure for hybridPerfStats if not present
          setHybridPerfStats({
            hitRates: { overall: 0, redis: 0, postgres: 0 },
            performance: { avgResponseTime: 0, totalRequests: 0 },
            errors: { redis: 0, postgres: 0, api: 0 },
            redis: { connected: false, limited: false, hits: 0, configured: false, connectionAttempts: 0 },
            mode: "unknown",
          })
        }
      } else {
        setCacheStats(overviewData.stats || {}) // Use partial stats if available from error response
        setHybridPerfStats(
          overviewData.stats?.performanceDetails ||
            {

            },
        )
        throw new Error(overviewData.error || "Failed to fetch cache overview stats")
      }

      if (!activeProcessesRes.ok) throw new Error(`Active Processes HTTP error! status: ${activeProcessesRes.status}`)
      const activeProcessesData = await activeProcessesRes.json()
      if (activeProcessesData.success) {
        const newActiveSyncs: Record<string, SyncStatus> = {}
        activeProcessesData.activeProcesses.forEach((p: any) => {
          newActiveSyncs[p.processId] = {
            processId: p.processId,
            type: p.processType,
            status: p.status,
            progress: p.totalItems > 0 ? (p.processedItems / p.totalItems) * 100 : p.status === "completed" ? 100 : 0,
            message: `Processed ${p.processedItems || 0} / ${p.totalItems || "N/A"}. Errors: ${p.failedItems || 0}. Batch: ${p.currentBatch || "N/A"}`,
            processedItems: p.processedItems,
            totalItems: p.totalItems,
            error: p.errorMessage,
          }
        })
        setActiveSyncs(newActiveSyncs)
      } else {
        setActiveSyncs({}) // Clear or handle error
      }
    } catch (e: any) {
      setError(e.message)
      console.error("Fetch error in fetchBackendStats:", e)
    } finally {
      setIsLoading(false)
    }
  }, []) // Removed fetchHybridStats from dependencies as it's no longer called directly

  // Remove the standalone fetchHybridStats function if it's not used elsewhere.

  const handleGenericProcess = async (
    endpoint: string,
    body: Record<string, any>,
    processType: string,
    setLoadingState?: (loading: boolean) => void, // Optional: for specific button loading
  ) => {
    if (setLoadingState) setLoadingState(true)
    else setIsLoading(true)
    setError(null)
    const processId = `${processType}-${Date.now()}` // Optimistic processId

    try {
      setActiveSyncs((prev) => ({
        ...prev,
        [processId]: { processId, type: processType, status: "starting", progress: 0, message: "Initiating..." },
      }))

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || `Failed to start ${processType}`)
      }

      // Actual processId from backend
      const backendProcessId = data.processId || processId
      if (backendProcessId !== processId) {
        setActiveSyncs((prev) => {
          const newState = { ...prev }
          delete newState[processId] // remove optimistic
          newState[backendProcessId] = {
            processId: backendProcessId,
            type: processType,
            status: "running",
            progress: 0,
            message: data.message || "Process started...",
          }
          return newState
        })
      } else {
        setActiveSyncs((prev) => ({
          ...prev,
          [backendProcessId]: {
            ...prev[backendProcessId],
            status: "running",
            message: data.message || "Process started...",
          },
        }))
      }

      alert(`✅ ${processType} started successfully. Process ID: ${backendProcessId}. ${data.message || ""}`)
      // Stats will be updated by the interval fetch or manually
    } catch (e: any) {
      setError(e.message)
      setActiveSyncs((prev) => ({
        ...prev,
        [processId]: { ...prev[processId], status: "failed", error: e.message, message: `Error: ${e.message}` },
      }))
      console.error(`${processType} error:`, e)
    } finally {
      if (setLoadingState) setLoadingState(false)
      else setIsLoading(false)
    }
  }

  const handleStopProcess = async (processId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/checkpoints/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.message || "Failed to stop process")
      alert(`Process ${processId} stop request sent.`)
      fetchBackendStats() // Refresh status
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBackendStats()
    const interval = setInterval(fetchBackendStats, 15000) // Refresh stats every 15s
    return () => clearInterval(interval)
  }, [fetchBackendStats])

  const renderSyncStatus = () => {
    const processes = Object.values(activeSyncs)
    if (processes.length === 0) return <p className="text-sm text-muted-foreground">No active background processes.</p>

    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Processes</CardTitle>
          <CardDescription>Monitoring background synchronization and processing tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {processes.map((p) => (
            <div key={p.processId || `process-${Math.random()}`} className="p-3 border rounded-md">
              <div className="flex justify-between items-center mb-1">
                <h4 className="font-semibold">
                  {p.type || "Unknown Process"}{" "}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {p.processId}
                  </Badge>
                </h4>
                <Badge
                  variant={p.status === "running" ? "default" : p.status === "completed" ? "secondary" : "destructive"}
                >
                  {p.status}
                </Badge>
              </div>
              {p.status === "running" && p.progress !== undefined && (
                <Progress value={p.progress} className="w-full h-2 mb-1" />
              )}
              <p className="text-xs text-muted-foreground">{p.message}</p>
              {p.error && <p className="text-xs text-red-500 mt-1">Error: {p.error}</p>}
              {p.status === "running" && (
                <Button
                  size="xs"
                  variant="destructive"
                  className="mt-2"
                  onClick={() => handleStopProcess(p.processId!)}
                >
                  Stop
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Enhanced Cache & Sync Dashboard</h2>
        <Button onClick={fetchBackendStats} variant="outline" size="sm" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {renderSyncStatus()}

      <Tabs defaultValue="controls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="overview">Cache Overview</TabsTrigger>
          <TabsTrigger value="hybrid_perf">Hybrid Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Property Synchronization</CardTitle>
                <CardDescription>Load properties from TokkoBroker API to your database.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="syncLimit" className="text-sm font-medium">
                    Properties per batch
                  </label>
                  <Input
                    id="syncLimit"
                    type="number"
                    value={syncLimit}
                    onChange={(e) => setSyncLimit(Number(e.target.value))}
                    placeholder="50"
                    min="1"
                    max="500"
                    className="w-full mt-1"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() =>
                      handleGenericProcess(
                        "/api/properties/sync",
                        { limit: syncLimit, mode: "incremental" },
                        "PropertySyncIncremental",
                      )
                    }
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" /> Incremental Sync
                  </Button>
                  <Button
                    onClick={() =>
                      handleGenericProcess(
                        "/api/properties/sync",
                        { limit: syncLimit, mode: "full" },
                        "PropertySyncFull",
                      )
                    }
                    variant="outline"
                    className="flex-1"
                  >
                    <ListChecks className="h-4 w-4 mr-2" /> Full Sync
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Image Processing</CardTitle>
                <CardDescription>Optimize and process property images.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="imageProcessLimit" className="text-sm font-medium">
                    Images per batch (for ImageOptService)
                  </label>
                  <Input
                    id="imageProcessLimit"
                    type="number"
                    value={imageProcessLimit}
                    onChange={(e) => setImageProcessLimit(Number(e.target.value))}
                    placeholder="20"
                    min="1"
                    max="100"
                    className="w-full mt-1"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() =>
                      handleGenericProcess(
                        "/api/images/process",
                        { batchSize: imageProcessLimit, mode: "incremental" },
                        "ImageProcessIncremental",
                      )
                    }
                    className="flex-1"
                  >
                    <Play className="h-4 w-4 mr-2" /> Incremental Process
                  </Button>
                  <Button
                    onClick={() =>
                      handleGenericProcess(
                        "/api/images/process",
                        { batchSize: imageProcessLimit, mode: "full" },
                        "ImageProcessFull",
                      )
                    }
                    variant="outline"
                    className="flex-1"
                  >
                    <ListChecks className="h-4 w-4 mr-2" /> Full Process
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Warming</CardTitle>
                <CardDescription>Preload frequently accessed properties into Redis.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => handleGenericProcess("/api/cache/warm", {}, "CacheWarm")} className="w-full">
                  <Zap className="h-4 w-4 mr-2" /> Warm Cache
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clear Cache</CardTitle>
                <CardDescription>Remove all items from Redis and mark PostgreSQL cache as stale.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleGenericProcess("/api/cache/clear", {}, "CacheClear")}
                  variant="destructive"
                  className="w-full"
                >
                  Clear All Cache
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats from /api/properties/cache-stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Properties (DB)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheStats?.totalProperties?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Featured (DB)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheStats?.featuredProperties?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Redis Property Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheStats?.redisKeys?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Redis Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    cacheStats?.redisMode === "active"
                      ? "default"
                      : cacheStats?.redisMode === "limited"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {cacheStats?.redisMode || "unknown"}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Processed Images (DB)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheStats?.processedImages?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pending Images (DB)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheStats?.pendingImages?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hybrid_perf" className="space-y-4">
          {/* Stats from /api/cache/stats */}
          {hybridPerfStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Cache Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={
                      hybridPerfStats.mode === "hybrid"
                        ? "default"
                        : hybridPerfStats.mode === "redis-limited"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {hybridPerfStats.mode}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Redis Hit Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{hybridPerfStats.hitRates?.redis?.toFixed(1) || 0}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>PostgreSQL Hit Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{hybridPerfStats.hitRates?.postgres?.toFixed(1) || 0}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Avg. Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {hybridPerfStats.performance?.avgResponseTime?.toFixed(0) || 0}ms
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Total Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {hybridPerfStats.performance?.totalRequests?.toLocaleString() || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Redis Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{hybridPerfStats.errors?.redis || 0}</div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p>Loading performance stats...</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default EnhancedCacheDashboard
