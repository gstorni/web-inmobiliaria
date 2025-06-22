import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Security middleware for TokkoBroker API routes
  if (request.nextUrl.pathname.startsWith("/api/tokko")) {
    // Only allow GET requests to TokkoBroker endpoints
    if (request.method !== "GET") {
      return NextResponse.json(
        {
          error: `${request.method} method not allowed on TokkoBroker endpoints`,
          allowedMethods: ["GET"],
          readOnlyMode: true,
        },
        { status: 405 },
      )
    }

    // Add security headers
    const response = NextResponse.next()
    response.headers.set("X-Read-Only-API", "true")
    response.headers.set("X-Allowed-Methods", "GET")
    response.headers.set("X-Content-Type-Options", "nosniff")

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/tokko/:path*"],
}
