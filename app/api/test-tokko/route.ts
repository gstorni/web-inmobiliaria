import { NextResponse } from "next/server"
import { secureTokkoClient } from "@/lib/enhanced-tokko-client"

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as Array<{ name: string; status: "pass" | "fail"; message: string; data?: unknown }>,
  }

  // Test 1: API Key Check
  const apiKey = process.env.TOKKO_API_KEY
  results.tests.push({
    name: "API Key Configuration",
    status: apiKey ? "pass" : "fail",
    message: apiKey ? "API key is configured" : "TOKKO_API_KEY environment variable not found",
  })

  if (!apiKey) {
    return NextResponse.json(results)
  }

  // Test 2: Basic Properties Fetch
  try {
    const properties = await secureTokkoClient.getProperties({ limit: "3" })
    results.tests.push({
      name: "Properties Fetch",
      status: "pass",
      message: `Successfully fetched ${properties.objects?.length || 0} properties`,
      data: {
        total: properties.meta?.total_count,
        sample: properties.objects?.slice(0, 2).map((p) => ({
          id: p.id,
          title: p.publication_title,
          price: p.price,
          currency: p.currency,
        })),
      },
    })
  } catch (error) {
    results.tests.push({
      name: "Properties Fetch",
      status: "fail",
      message: `Error: ${error}`,
    })
  }

  // Test 3: Property Types
  try {
    const types = await secureTokkoClient.getPropertyTypes()
    results.tests.push({
      name: "Property Types",
      status: "pass",
      message: `Fetched ${types.objects?.length || 0} property types`,
      data: types.objects?.slice(0, 5).map((t) => ({ id: t.id, name: t.name })),
    })
  } catch (error) {
    results.tests.push({
      name: "Property Types",
      status: "fail",
      message: `Error: ${error}`,
    })
  }

  // Test 4: Locations
  try {
    const locations = await secureTokkoClient.getLocations()
    results.tests.push({
      name: "Locations",
      status: "pass",
      message: `Fetched ${locations.objects?.length || 0} locations`,
      data: locations.objects?.slice(0, 5).map((l) => ({
        id: l.id,
        name: l.name,
        parent: l.parent?.name,
      })),
    })
  } catch (error) {
    results.tests.push({
      name: "Locations",
      status: "fail",
      message: `Error: ${error}`,
    })
  }

  // Test 5: Security Check
  try {
    await secureTokkoClient.createProperty()
    results.tests.push({
      name: "Security Check",
      status: "fail",
      message: "Security failed - write operations should be blocked",
    })
  } catch (error) {
    results.tests.push({
      name: "Security Check",
      status: "pass",
      message: "Security working - write operations properly blocked",
    })
  }

  return NextResponse.json(results)
}
