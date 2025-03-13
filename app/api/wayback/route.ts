import { NextResponse } from "next/server"
import { checkDomainHistory } from "@/lib/wayback-api"

export async function POST(request: Request) {
  try {
    const { domain } = await request.json()

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    console.log(`Processing domain: ${domain}`)

    // Correctly call the checkDomainHistory function from wayback-api.js
    const result = await checkDomainHistory(domain)

    // Ensure we're returning the logs and messageChunks in the response
    return NextResponse.json({
      success: true,
      results: result.logs,
      messageChunks: result.messageChunks,
    })
  } catch (error) {
    console.error("Error in wayback API route:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check domain",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

