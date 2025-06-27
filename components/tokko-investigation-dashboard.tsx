"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2, Search, AlertTriangle, Info } from "lucide-react"

interface ApiTest {
  name: string
  endpoint: string
  status: number
  success: boolean
  data?: any
  error?: string
  responseTime: number
  analysis?: string
}

interface InvestigationResults {
  timestamp: string
  apiKey: string
  findings: any
  tests: ApiTest[]
  conclusions: {
    why404ForIds123: string
    whyLimitedProperties: string
    propertyIdPattern: string
    recommendations: string[]
  }
}

export function TokkoInvestigationDashboard() {
  const [results, setResults] = useState<InvestigationResults | null>(null)
  const [loading, setLoading] = useState(false)

  const runInvestigation = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/investigate-tokko")
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error("Investigation failed:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">TokkoBroker API Investigation</h1>
        <p className="text-gray-600 mb-6">
          Comprehensive analysis of TokkoBroker API behavior, property ID patterns, and endpoint responses.
        </p>

        <Button onClick={runInvestigation} disabled={loading} size="lg">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Investigating...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Start Investigation
            </>
          )}
        </Button>
      </div>

      {results && (
        <div className="space-y-6">
          {/* Key Findings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="h-5 w-5 mr-2" />
                Key Findings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{results.findings.totalTests}</div>
                  <div className="text-sm text-gray-600">Total Tests</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{results.findings.successfulTests}</div>
                  <div className="text-sm text-gray-600">Successful</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{results.findings.failedTests}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conclusions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Why the Issues Occur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">🚫 Why /propiedades/1 gives 404:</h4>
                  <p className="text-red-700">{results.conclusions.why404ForIds123}</p>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">📊 Why only 4 properties show:</h4>
                  <p className="text-yellow-700">{results.conclusions.whyLimitedProperties}</p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">🔢 Property ID Pattern:</h4>
                  <p className="text-blue-700">{results.conclusions.propertyIdPattern}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Listing Behavior */}
          <Card>
            <CardHeader>
              <CardTitle>Property Listing Behavior</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.findings.propertyListingBehavior.map((behavior: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{behavior.name}</span>
                      <div className="text-sm text-gray-600">{behavior.analysis}</div>
                    </div>
                    <Badge variant="outline">
                      {behavior.propertiesReturned} / {behavior.totalAvailable}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Individual Property Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Individual Property Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-green-600 mb-3">✅ Working Property IDs</h4>
                  <div className="space-y-2">
                    {results.findings.individualPropertyBehavior.workingIds.map((prop: any, index: number) => (
                      <div key={index} className="p-2 bg-green-50 rounded text-sm">
                        <span className="font-mono">ID {prop.id}</span>: {prop.title || "No title"}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-red-600 mb-3">❌ Non-existent Property IDs</h4>
                  <div className="space-y-2">
                    {results.findings.individualPropertyBehavior.nonExistentIds.map((prop: any, index: number) => (
                      <div key={index} className="p-2 bg-red-50 rounded text-sm">
                        <span className="font-mono">ID {prop.id}</span>: {prop.error}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>💡 Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {results.conclusions.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Detailed Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.tests.map((test, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      test.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {test.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">{test.name}</span>
                        <Badge variant={test.success ? "default" : "destructive"}>{test.status}</Badge>
                      </div>
                      <span className="text-xs text-gray-500">{test.responseTime}ms</span>
                    </div>

                    <div className="text-sm text-gray-600 mb-2">{test.analysis || test.error}</div>

                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Endpoint</summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">{test.endpoint}</pre>
                    </details>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}