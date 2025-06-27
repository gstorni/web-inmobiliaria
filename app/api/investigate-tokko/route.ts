import { NextResponse } from "next/server"

const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

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

export async function GET() {
  if (!TOKKO_API_KEY) {
    return NextResponse.json(
      {
        error: "TOKKO_API_KEY not configured",
        message: "Add your TokkoBroker API key to environment variables",
      },
      { status: 500 },
    )
  }

  const tests: ApiTest[] = []

  // Helper function to test an endpoint
  async function testEndpoint(name: string, endpoint: string): Promise<ApiTest> {
    const startTime = Date.now()

    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })

      const responseTime = Date.now() - startTime
      let data: any = null
      let analysis = ""

      if (response.ok) {
        data = await response.json()

        // Analyze the response
        if (data.objects) {
          analysis = `Found ${data.objects.length} objects. Total available: ${data.meta?.total_count || "Unknown"}`
          if (data.objects.length > 0) {
            const firstId = data.objects[0].id
            const lastId = data.objects[data.objects.length - 1].id
            analysis += `. Property IDs range: ${firstId} to ${lastId}`
          }
        } else if (data.id) {
          analysis = `Single property with ID ${data.id}: ${data.publication_title || data.type?.name || "No title"}`
        }
      } else {
        const errorText = await response.text()
        analysis = `HTTP ${response.status}: ${response.statusText}. ${errorText}`
      }

      return {
        name,
        endpoint,
        status: response.status,
        success: response.ok,
        data: response.ok ? data : undefined,
        error: response.ok ? undefined : analysis,
        responseTime,
        analysis,
      }
    } catch (error) {
      return {
        name,
        endpoint,
        status: 0,
        success: false,
        error: `Network error: ${error}`,
        responseTime: Date.now() - startTime,
        analysis: "Failed to connect to API",
      }
    }
  }

  // Test 1: Basic properties list
  tests.push(
    await testEndpoint("Properties List (Default)", `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json`),
  )

  // Test 2: Properties with different limits
  tests.push(
    await testEndpoint(
      "Properties List (Limit 1)",
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&limit=1`,
    ),
  )

  tests.push(
    await testEndpoint(
      "Properties List (Limit 20)",
      `${TOKKO_API_URL}/property/?key=${TOKKO_API_KEY}&format=json&limit=20`,
    ),
  )

  // Get real property IDs from the first successful test
  const propertiesTest = tests.find((test) => test.success && test.data?.objects?.length > 0)
  let realPropertyIds: number[] = []

  if (propertiesTest?.data?.objects) {
    realPropertyIds = propertiesTest.data.objects.slice(0, 3).map((prop: any) => prop.id)
  }

  // Test 3: Individual properties with real IDs
  for (const id of realPropertyIds) {
    tests.push(
      await testEndpoint(
        `Individual Property (Real ID: ${id})`,
        `${TOKKO_API_URL}/property/${id}/?key=${TOKKO_API_KEY}&format=json`,
      ),
    )
  }

  // Test 4: Individual properties with fake IDs
  const fakeIds = [1, 2, 3, 999999]
  for (const id of fakeIds) {
    tests.push(
      await testEndpoint(
        `Individual Property (Fake ID: ${id})`,
        `${TOKKO_API_URL}/property/${id}/?key=${TOKKO_API_KEY}&format=json`,
      ),
    )
  }

  // Analysis
  const successfulTests = tests.filter((test) => test.success)
  const failedTests = tests.filter((test) => !test.success)
  const propertyListTests = tests.filter((test) => test.name.includes("Properties List") && test.success)
  const individualTests = tests.filter((test) => test.name.includes("Individual Property"))
  const successfulIndividual = individualTests.filter((test) => test.success)
  const failedIndividual = individualTests.filter((test) => !test.success)

  // Key findings
  const findings = {
    totalTests: tests.length,
    successfulTests: successfulTests.length,
    failedTests: failedTests.length,

    // Property listing analysis
    propertyListingBehavior: propertyListTests.map((test) => ({
      name: test.name,
      propertiesReturned: test.data?.objects?.length || 0,
      totalAvailable: test.data?.meta?.total_count || 0,
      analysis: test.analysis,
    })),

    // Individual property analysis
    individualPropertyBehavior: {
      totalTested: individualTests.length,
      successful: successfulIndividual.length,
      failed: failedIndividual.length,
      workingIds: successfulIndividual.map((test) => {
        const id = test.endpoint.match(/\/property\/(\d+)\//)?.[1]
        return { id: Number(id), title: test.data?.publication_title || test.data?.type?.name }
      }),
      nonExistentIds: failedIndividual.map((test) => {
        const id = test.endpoint.match(/\/property\/(\d+)\//)?.[1]
        return { id: Number(id), error: test.error }
      }),
    },

    // Real property ID range
    realPropertyIds,
    propertyIdRange:
      realPropertyIds.length > 0
        ? {
            min: Math.min(...realPropertyIds),
            max: Math.max(...realPropertyIds),
            sample: realPropertyIds,
          }
        : null,
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    apiKey: `${TOKKO_API_KEY.substring(0, 8)}...${TOKKO_API_KEY.substring(TOKKO_API_KEY.length - 4)}`,
    findings,
    tests,
    conclusions: {
      why404ForIds123:
        "Property IDs 1, 2, 3 don't exist in the TokkoBroker database. Property IDs are not sequential starting from 1.",
      whyLimitedProperties:
        "The API returns a default number of properties (usually 20) unless you specify a 'limit' parameter.",
      propertyIdPattern:
        realPropertyIds.length > 0
          ? `Real property IDs start from around ${Math.min(...realPropertyIds)} and are not sequential`
          : "Could not determine property ID pattern",
      recommendations: [
        "Always fetch real property IDs from /property/ endpoint first",
        "Use the 'limit' parameter to control how many properties are returned",
        "Use 'offset' parameter for pagination",
        "Check 'meta.total_count' to see total available properties",
        "Don't assume property IDs start from 1 or are sequential",
      ],
    },
  })
}
