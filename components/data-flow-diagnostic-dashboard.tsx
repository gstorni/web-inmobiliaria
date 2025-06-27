"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Database, Zap, Cloud, ImageIcon, CheckCircle, XCircle, AlertTriangle, RefreshCw } from "lucide-react"

interface DataFlowAnalysis {
  propertyId: number
  dataFlow: {
    redis: { available: boolean; data?: any; responseTime?: number; error?: string }
    neon: { available: boolean; data?: any; responseTime?: number; error?: string }
    api: { available: boolean; data?: any; responseTime?: number; error?: string }
  }
  imageFlow: {
    originalImages: number
    processedImages: number
    availableFormats: string[]
    missingImages: string[]
    processingErrors: any[]
  }
  recommendations: string[]
}

export function DataFlowDiagnosticDashboard() {
  const [analysis, setAnalysis] = useState<DataFlowAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [propertyId, setPropertyId] = useState("3883072")

  const runDiagnostic = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/diagnostics/data-flow?propertyId=${propertyId}`)
      const data = await response.json()

      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        console.error("Diagnostic failed:", data.error)
      }
    } catch (error) {
      console.error("Diagnostic error:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (available: boolean) => {
    return available ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />
  }

  const getResponseTimeColor = (time?: number) => {
    if (!time) return "text-gray-500"
    if (time < 100) return "text-green-500"
    if (time < 500) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Flow Diagnostic Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="Property ID"
              className="px-3 py-2 border rounded-md"
            />
            <Button onClick={runDiagnostic} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
              Run Diagnostic
            </Button>
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          {/* Data Flow Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Redis */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-red-500" />
                  Redis Cache
                  {getStatusIcon(analysis.dataFlow.redis.available)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant={analysis.dataFlow.redis.available ? "default" : "destructive"}>
                      {analysis.dataFlow.redis.available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  {analysis.dataFlow.redis.responseTime && (
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span className={getResponseTimeColor(analysis.dataFlow.redis.responseTime)}>
                        {analysis.dataFlow.redis.responseTime}ms
                      </span>
                    </div>
                  )}
                  {analysis.dataFlow.redis.data && (
                    <div className="flex justify-between">
                      <span>Images:</span>
                      <span>{analysis.dataFlow.redis.data.imageCount || 0}</span>
                    </div>
                  )}
                  {analysis.dataFlow.redis.error && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{analysis.dataFlow.redis.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Neon */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Database className="h-4 w-4 text-blue-500" />
                  Neon Database
                  {getStatusIcon(analysis.dataFlow.neon.available)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant={analysis.dataFlow.neon.available ? "default" : "destructive"}>
                      {analysis.dataFlow.neon.available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  {analysis.dataFlow.neon.responseTime && (
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span className={getResponseTimeColor(analysis.dataFlow.neon.responseTime)}>
                        {analysis.dataFlow.neon.responseTime}ms
                      </span>
                    </div>
                  )}
                  {analysis.dataFlow.neon.data && (
                    <div className="flex justify-between">
                      <span>Images:</span>
                      <span>{analysis.dataFlow.neon.data.imageCount || 0}</span>
                    </div>
                  )}
                  {analysis.dataFlow.neon.error && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{analysis.dataFlow.neon.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* API */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Cloud className="h-4 w-4 text-orange-500" />
                  Tokko API
                  {getStatusIcon(analysis.dataFlow.api.available)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant={analysis.dataFlow.api.available ? "default" : "destructive"}>
                      {analysis.dataFlow.api.available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  {analysis.dataFlow.api.responseTime && (
                    <div className="flex justify-between">
                      <span>Response Time:</span>
                      <span className={getResponseTimeColor(analysis.dataFlow.api.responseTime)}>
                        {analysis.dataFlow.api.responseTime}ms
                      </span>
                    </div>
                  )}
                  {analysis.dataFlow.api.data && (
                    <div className="flex justify-between">
                      <span>Images:</span>
                      <span>{analysis.dataFlow.api.data.imageCount || 0}</span>
                    </div>
                  )}
                  {analysis.dataFlow.api.error && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{analysis.dataFlow.api.error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Image Flow Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Image Processing Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{analysis.imageFlow.originalImages}</div>
                  <div className="text-sm text-gray-500">Original Images</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{analysis.imageFlow.processedImages}</div>
                  <div className="text-sm text-gray-500">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{analysis.imageFlow.missingImages.length}</div>
                  <div className="text-sm text-gray-500">Missing</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{analysis.imageFlow.processingErrors.length}</div>
                  <div className="text-sm text-gray-500">Errors</div>
                </div>
              </div>

              {analysis.imageFlow.availableFormats.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Available Formats:</h4>
                  <div className="flex gap-2">
                    {analysis.imageFlow.availableFormats.map((format) => (
                      <Badge key={format} variant="outline">
                        {format.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {analysis.imageFlow.processingErrors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Processing Errors:</h4>
                  <div className="space-y-2">
                    {analysis.imageFlow.processingErrors.slice(0, 3).map((error, index) => (
                      <Alert key={index}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {error.url}: {error.error}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.recommendations.map((rec, index) => (
                    <Alert key={index}>
                      <AlertDescription>{rec}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
