import { checkDomainHistory } from "../../../lib/wayback-api.js"
import { NextResponse } from "next/server"
export const runtime = "edge"

export async function POST(request: Request) {
  try {
    // Validate request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          details: "Request body must be valid JSON",
        },
        { status: 400 },
      )
    }

    const { domain } = body

    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          error: "Domain is required",
        },
        { status: 400 },
      )
    }

    // Call checkDomainHistory with error handling
    try {
      const results = await checkDomainHistory(domain)

      // Ensure results is serializable
      const safeResults = {
        success: true,
        logs: results.logs || [],
        messageChunks: results.messageChunks || [],
        executionTime: results.executionTime || {
          seconds: "0.00",
          formatted: "00:00:00",
          ms: 0,
        },
      }

      return NextResponse.json(safeResults)
    } catch (error) {
      console.error("Error checking domain history:", error)

      return NextResponse.json(
        {
          success: false,
          error: "Failed to check domain",
          details: error instanceof Error ? error.message : String(error),
          logs: [],
          messageChunks: [],
          executionTime: {
            seconds: "0.00",
            formatted: "00:00:00",
            ms: 0,
          },
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Unexpected error in wayback API route:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        logs: [],
        messageChunks: [],
        executionTime: {
          seconds: "0.00",
          formatted: "00:00:00",
          ms: 0,
        },
      },
      { status: 500 },
    )
  }
}

