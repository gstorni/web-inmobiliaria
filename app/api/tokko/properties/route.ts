import { type NextRequest, NextResponse } from "next/server"
import type { TokkoApiResponse, TokkoProperty } from "@/lib/tokko-types"
import { transformTokkoProperty } from "@/lib/tokko-transformer"

// TokkoBroker API configuration
const TOKKO_API_URL = "https://www.tokkobroker.com/api/v1"
const TOKKO_API_KEY = process.env.TOKKO_API_KEY

export async function GET(request: NextRequest) {
  console.log("🚀 API Route called: /api/tokko/properties")

  try {
    const { searchParams } = new URL(request.url)

    // Get pagination parameters with better defaults
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100) // Max 100 per request
    const offset = Number(searchParams.get("offset")) || 0

    // Get filter parameters
    const propertyTypeId = searchParams.get("type") // Property type ID
    const developmentTypeId = searchParams.get("development_type") // Development type ID
    const location = searchParams.get("location")
    const operation = searchParams.get("operation")
    const tags = searchParams.get("tags") // Comma-separated tag IDs
    const searchQuery = searchParams.get("q")
    const minPrice = searchParams.get("minPrice")
    const maxPrice = searchParams.get("maxPrice")

    console.log("📋 Request parameters:", {
      limit,
      offset,
      propertyTypeId,
      developmentTypeId,
      location,
      operation,
      tags,
      searchQuery,
      minPrice,
      maxPrice,
      minSurface: searchParams.get("minSurface"),
      maxSurface: searchParams.get("maxSurface"),
    })

    // Check if API key is available
    if (!TOKKO_API_KEY) {
      console.error("❌ TOKKO_API_KEY not found")
      return NextResponse.json(
        {
          error: "API key not configured",
          message: "TOKKO_API_KEY environment variable is required",
        },
        { status: 500 },
      )
    }

    console.log(`🔑 API Key available: ${TOKKO_API_KEY.substring(0, 8)}...`)

    // Determine if we should use search endpoint (when filters are applied)
    const hasFilters =
      propertyTypeId || developmentTypeId || location || operation || tags || minPrice || maxPrice || searchQuery

    if (hasFilters) {
      console.log("🔍 Using GET search endpoint due to filters")
      return await handleSearchRequest(limit, offset, searchParams)
    } else {
      console.log("📋 Using basic property listing endpoint")
      return await handleBasicRequest(limit, offset)
    }
  } catch (error) {
    console.error("❌ Unexpected error in API route:", error)

    return NextResponse.json(
      {
        error: "Failed to fetch properties",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function handleSearchRequest(limit: number, offset: number, searchParams: URLSearchParams) {
  const propertyTypeId = searchParams.get("type")
  const location = searchParams.get("location")
  const operation = searchParams.get("operation")
  const tags = searchParams.get("tags")
  const searchQuery = searchParams.get("q")
  const minPrice = searchParams.get("minPrice")
  const maxPrice = searchParams.get("maxPrice")

  // Build search_data object according to TokkoBroker API spec
  const searchData: any = {
    current_localization_id: 1, // Argentina (country level)
    current_localization_type: "country",
    currency: "USD", // Default currency
    operation_types: [1, 2, 3], // All operations by default (Sale, Rent, Temporary Rent)
  }

  // Property types filter
  if (propertyTypeId) {
    searchData.property_types = [Number.parseInt(propertyTypeId)]
    console.log(`🏠 Property types filter: [${propertyTypeId}]`)
  } else {
    // Default to industrial property types if none specified
    searchData.property_types = [1, 5, 7, 8, 12, 14, 24, 27] // Land, Office, Business Premises, Commercial Building, Industrial Ship, Storage, Warehouse, Industrial Land
  }

  // Operation types filter (1: Sale, 2: Rent, 3: Temporary_rent)
  if (operation) {
    const operationMap: Record<string, number> = {
      Venta: 1,
      Sale: 1,
      Alquiler: 2,
      Rent: 2,
      "Alquiler Temporal": 3,
      "Temporary Rent": 3,
    }
    const operationId = operationMap[operation]
    if (operationId) {
      searchData.operation_types = [operationId]
      console.log(`💼 Operation types filter: [${operationId}] (${operation})`)
    }
  }

  // Location filter - if specific location provided, use division level
  if (location) {
    searchData.current_localization_type = "division"
    searchData.current_localization_id = [Number.parseInt(location)]
    console.log(`📍 Location filter: [${location}] (division level)`)
  }

  // Tags filter
  if (tags) {
    const tagIds = tags
      .split(",")
      .map((id) => Number.parseInt(id.trim()))
      .filter((id) => !isNaN(id))
    if (tagIds.length > 0) {
      searchData.with_tags = tagIds
      console.log(`🏷️ Tags filter: [${tagIds.join(", ")}]`)
    }
  }

  // Price filters
  if (minPrice) {
    const price = Number.parseInt(minPrice)
    if (!isNaN(price)) {
      searchData.price_from = price
      console.log(`💰 Min price filter: ${price}`)
    }
  } else {
    searchData.price_from = 0 // Default minimum
  }

  if (maxPrice) {
    const price = Number.parseInt(maxPrice)
    if (!isNaN(price)) {
      searchData.price_to = price
      console.log(`💰 Max price filter: ${price}`)
    }
  } else {
    searchData.price_to = 10000000 // Default maximum (10M USD)
  }

  // Surface filters
  if (searchParams.get("minSurface")) {
    const surface = Number.parseInt(searchParams.get("minSurface")!)
    if (!isNaN(surface)) {
      searchData.surface_from = surface
      console.log(`📐 Min surface filter: ${surface} m²`)
    }
  }

  if (searchParams.get("maxSurface")) {
    const surface = Number.parseInt(searchParams.get("maxSurface")!)
    if (!isNaN(surface)) {
      searchData.surface_to = surface
      console.log(`📐 Max surface filter: ${surface} m²`)
    }
  }

  console.log("🔍 Search data object:", JSON.stringify(searchData, null, 2))

  // URL encode the search data object
  const encodedSearchData = encodeURIComponent(JSON.stringify(searchData))

  // Build the GET request URL with data parameter
  const apiUrl = `${TOKKO_API_URL}/property/search?data=${encodedSearchData}&key=${TOKKO_API_KEY}&limit=${limit}&offset=${offset}`

  console.log(`📡 Calling TokkoBroker Search API: ${apiUrl}`)

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "IndustrialPro/1.0",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    console.log(`📡 TokkoBroker Search API Response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      console.error(`❌ TokkoBroker Search API error: ${response.status} ${response.statusText}`)

      // Try to get error details
      try {
        const errorText = await response.text()
        console.error(`❌ Error details: ${errorText}`)
      } catch (e) {
        console.error("❌ Could not read error response")
      }

      // If search fails, fall back to basic endpoint
      console.log("🔄 Falling back to basic endpoint due to search API error")
      return await handleBasicRequest(limit, offset)
    }

    // Parse JSON response
    let data: TokkoApiResponse<TokkoProperty>
    try {
      data = await response.json()
      console.log(`✅ Successfully parsed search JSON response`)
    } catch (jsonError) {
      console.error("❌ Search JSON Parse Error:", jsonError)
      console.log("🔄 Falling back to basic endpoint due to search JSON parse error")
      return await handleBasicRequest(limit, offset)
    }

    console.log(
      `📊 Search API Response: ${data.objects?.length || 0} properties, total: ${data.meta?.total_count || 0}`,
    )

    // Transform and return
    return transformAndReturnResponse(data, limit, offset, searchParams, "tokko-search-api")
  } catch (fetchError) {
    console.error("❌ Search API fetch error:", fetchError)
    console.log("🔄 Falling back to basic endpoint due to search fetch error")
    return await handleBasicRequest(limit, offset)
  }
}

async function handleBasicRequest(limit: number, offset: number) {
  // Build query parameters for basic TokkoBroker API
  const params = new URLSearchParams({
    key: TOKKO_API_KEY!,
    limit: limit.toString(),
    offset: offset.toString(),
    format: "json",
  })

  const apiUrl = `${TOKKO_API_URL}/property/?${params}`
  console.log(`📡 Calling TokkoBroker Basic API: ${apiUrl}`)

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "IndustrialPro/1.0",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    console.log(`📡 TokkoBroker Basic API Response: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      console.error(`❌ TokkoBroker Basic API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        {
          error: `TokkoBroker API error: ${response.status} ${response.statusText}`,
          message: "Failed to fetch properties from TokkoBroker API",
        },
        { status: response.status },
      )
    }

    // Parse JSON response
    let data: TokkoApiResponse<TokkoProperty>
    try {
      data = await response.json()
      console.log(`✅ Successfully parsed basic JSON response`)
    } catch (jsonError) {
      console.error("❌ Basic JSON Parse Error:", jsonError)
      return NextResponse.json(
        {
          error: "Invalid JSON response from TokkoBroker API",
          message: "Failed to parse API response",
        },
        { status: 500 },
      )
    }

    console.log(`📊 Basic API Response: ${data.objects?.length || 0} properties, total: ${data.meta?.total_count || 0}`)

    // Transform and return
    return transformAndReturnResponse(data, limit, offset, new URLSearchParams(), "tokko-basic-api")
  } catch (fetchError) {
    console.error("❌ Basic API fetch error:", fetchError)
    return NextResponse.json(
      {
        error: "Network error",
        message: fetchError instanceof Error ? fetchError.message : "Failed to connect to TokkoBroker API",
      },
      { status: 500 },
    )
  }
}

function transformAndReturnResponse(
  data: TokkoApiResponse<TokkoProperty>,
  limit: number,
  offset: number,
  searchParams: URLSearchParams,
  source: string,
) {
  // Log first property structure for debugging
  if (data.objects && data.objects.length > 0) {
    console.log("🔍 First property structure:", JSON.stringify(data.objects[0], null, 2))
  }

  // Transform TokkoBroker data to our format
  let transformedProperties
  try {
    transformedProperties = (data.objects || []).map(transformTokkoProperty)
    console.log(`✅ Successfully transformed ${transformedProperties.length} properties`)

    // Log first transformed property for debugging
    if (transformedProperties.length > 0) {
      console.log("🔍 First transformed property:", JSON.stringify(transformedProperties[0], null, 2))
    }
  } catch (transformError) {
    console.error("❌ Transform Error:", transformError)
    return NextResponse.json(
      {
        error: "Data transformation error",
        message: "Failed to transform property data",
      },
      { status: 500 },
    )
  }

  const responseData = {
    properties: transformedProperties,
    total: data.meta?.total_count || 0,
    hasNext: data.meta?.next !== null,
    hasPrevious: data.meta?.previous !== null,
    currentPage: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil((data.meta?.total_count || 0) / limit),
    limit,
    offset,
    appliedFilters: {
      propertyType: searchParams.get("type"),
      developmentType: searchParams.get("development_type"),
      operation: searchParams.get("operation"),
      tags: searchParams.get("tags") ? searchParams.get("tags")!.split(",") : [],
      location: searchParams.get("location"),
      minPrice: searchParams.get("minPrice"),
      maxPrice: searchParams.get("maxPrice"),
      searchQuery: searchParams.get("q"),
    },
    source,
  }

  console.log("✅ Returning successful response")
  return NextResponse.json(responseData)
}
