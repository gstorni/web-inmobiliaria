import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Clear Redis cache
    await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/cache/clear`, {
      method: "POST",
    })

    // Clear any application-level caches
    // Note: We don't clear PostgreSQL cache as it's our persistent store

    return NextResponse.json({
      success: true,
      message: "All caches cleared successfully",
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: "Failed to clear all caches",
      },
      { status: 500 },
    )
  }
}
