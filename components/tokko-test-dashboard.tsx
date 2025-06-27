"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2, Play, RefreshCw } from "lucide-react"

interface TestResult {
  name: string
  status: "pass" | "fail"
  message: string
  data?: unknown
}

interface TestResults {
  timestamp: string
  tests: TestResult[]
}

export function TokkoTestDashboard() {
  const [results, setResults] = useState<TestResults | null>(null)
  const [loading, setLoading] = useState(false)

  const runTests = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/test-tokko")
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error("Test failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const passedTests = results?.tests.filter((t) => t.status === "pass").length || 0
  const totalTests = results?.tests.length || 0

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">TokkoBroker API Test Dashboard</h1>
        <p className="text-gray-600 mb-6">
          Test your TokkoBroker API integration to ensure everything is working correctly.
        </p>

        <Button onClick={runTests} disabled={loading} size="lg">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run API Tests
            </>
          )}
        </Button>
      </div>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Results</span>
              <div className="flex items-center space-x-2">
                <Badge variant={passedTests === totalTests ? "default" : "destructive"}>
                  {passedTests}/{totalTests} Passed
                </Badge>
                <Button variant="outline" size="sm" onClick={runTests}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
            <p className="text-sm text-gray-500">Last run: {new Date(results.timestamp).toLocaleString()}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.tests.map((test, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    test.status === "pass" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    {test.status === "pass" ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <h3 className="font-semibold">{test.name}</h3>
                    <Badge variant={test.status === "pass" ? "default" : "destructive"}>{test.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{test.message}</p>
                  {test.data && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Data</summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto">
                        {JSON.stringify(test.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1. Get your TokkoBroker API Key</h4>
            <p className="text-sm text-gray-600">
              Contact TokkoBroker to obtain your API key for accessing their property data.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2. Add to Environment Variables</h4>
            <p className="text-sm text-gray-600 mb-2">
              Add your API key to your <code>.env.local</code> file:
            </p>
            <pre className="bg-gray-100 p-2 rounded text-xs">TOKKO_API_KEY=your_api_key_here</pre>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. Test the Integration</h4>
            <p className="text-sm text-gray-600">
              Click "Run API Tests" above to verify your integration is working correctly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
