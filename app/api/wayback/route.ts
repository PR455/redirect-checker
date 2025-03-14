import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { domain } = body

    if (!domain) {
      return NextResponse.json({ success: false, error: "Domain is required" }, { status: 400 })
    }

    // Import wayback-api.js secara dinamis
    const waybackApi = await import("@/lib/wayback-api")

    // Panggil fungsi checkDomainHistory
    const result = await waybackApi.checkDomainHistory(domain)

    return NextResponse.json({
      success: true,
      results: result.messageChunks,
      executionTime: result.executionTime,
    })
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
        details: "Failed to check domain with Wayback Machine",
      },
      { status: 500 },
    )
  }
}

