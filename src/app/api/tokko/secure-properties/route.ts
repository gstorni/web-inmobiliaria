import { type NextRequest, NextResponse } from "next/server"
import { secureTokkoClient } from "@/lib/enhanced-tokko-client"
import { TokkoSecurityManager } from "@/lib/tokko-security"

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0] : "unknown"
  return `rate_limit:${ip}`
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const limit = rateLimitStore.get(key)

  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + 15 * 60 * 1000 })
    return true
  }

  if (limit.count >= 100) {
    return false
  }

  limit.count++
  return true
}

export async function GET(request: NextRequest) {
  const security = TokkoSecurityManager.getInstance()

  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request)
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 })
    }

    // Validate request method (redundant but explicit)
    if (request.method !== "GET") {
      return NextResponse.json({ error: "Only GET requests allowed. Read-only access enforced." }, { status: 405 })
    }

    // Extract and validate query parameters
    const { searchParams } = new URL(request.url)
    const rawParams = Object.fromEntries(searchParams.entries())

    // Sanitize parameters
    const sanitizedParams = security.sanitizeQueryParams(rawParams)

    // Fetch data using secure client
    const data = await secureTokkoClient.getProperties(sanitizedParams)

    // Add security headers to response
    const response = NextResponse.json({
      properties: data.objects || [],
      total: data.meta?.total_count || 0,
      hasNext: data.meta?.next !== null,
      security: {
        readOnlyMode: true,
        timestamp: new Date().toISOString(),
      },
    })

    // Security headers
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-Read-Only-Mode", "enforced")
    response.headers.set("Cache-Control", "public, max-age=300") // 5 minutes cache

    return response
  } catch (error) {
    console.error("Secure API error:", error)

    return NextResponse.json(
      {
        error: "Failed to fetch properties",
        readOnlyMode: true,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Explicitly disable other HTTP methods
export async function POST() {
  return NextResponse.json({ error: "POST method not allowed. Read-only access only." }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: "PUT method not allowed. Read-only access only." }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: "DELETE method not allowed. Read-only access only." }, { status: 405 })
}

export async function PATCH() {
  return NextResponse.json({ error: "PATCH method not allowed. Read-only access only." }, { status: 405 })
}
