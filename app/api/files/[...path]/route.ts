import { type NextRequest, NextResponse } from "next/server"
import { neonBlobStorage } from "@/lib/neon-blob-storage"

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params

    if (!path || path.length === 0) {
      return NextResponse.json({ error: "File path is required" }, { status: 400 })
    }

    // Extract file ID from the path
    const fileId = path[0]
    const filename = path[1] || undefined

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 })
    }

    // Get file from blob storage
    const file = await neonBlobStorage.getFile(fileId)

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Update access statistics
    await neonBlobStorage.updateFileAccess(fileId)

    // Set appropriate headers for caching and content type
    const headers = new Headers({
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": file.buffer.length.toString(),
      "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
      ETag: `"${fileId}"`,
      "Last-Modified": file.createdAt ? new Date(file.createdAt).toUTCString() : new Date().toUTCString(),
    })

    // Set filename if provided
    if (filename) {
      headers.set("Content-Disposition", `inline; filename="${filename}"`)
    }

    // Handle conditional requests
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === `"${fileId}"`) {
      return new NextResponse(null, { status: 304, headers })
    }

    return new NextResponse(file.buffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Error serving file:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Handle HEAD requests for file metadata
export async function HEAD(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const { path } = params
    const fileId = path?.[0]

    if (!fileId) {
      return new NextResponse(null, { status: 400 })
    }

    // Get file metadata only
    const fileExists = await neonBlobStorage.fileExists(fileId)

    if (!fileExists) {
      return new NextResponse(null, { status: 404 })
    }

    // Return headers without body
    const headers = new Headers({
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${fileId}"`,
    })

    return new NextResponse(null, { status: 200, headers })
  } catch (error) {
    console.error("Error checking file:", error)
    return new NextResponse(null, { status: 500 })
  }
}
