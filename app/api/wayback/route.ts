import { NextResponse } from "next/server"

// Fix: Changed force_dynamic to force-dynamic
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Rest of the code remains the same
export async function POST(req: Request) {
  try {
    console.log("API endpoint hit: /api/wayback")

    const body = await req.json()
    const { domain } = body

    console.log("Received domain:", domain)

    if (!domain) {
      console.log("Error: Domain is required")
      return NextResponse.json(
        {
          success: false,
          error: "Domain is required",
        },
        { status: 400 },
      )
    }

    // Add explicit CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store, max-age=0",
    }

    const apiUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&fl=timestamp,original,statuscode,redirect`

    console.log("Fetching from Wayback Machine:", apiUrl)

    const response = await fetch(apiUrl)

    if (!response.ok) {
      console.log("Wayback Machine API returned error status:", response.status)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch from Wayback Machine: ${response.status}`,
        },
        {
          status: 500,
          headers,
        },
      )
    }

    const data = await response.json()
    console.log("Wayback Machine response received, entries:", data.length)

    if (!Array.isArray(data) || data.length <= 1) {
      console.log("No results found or invalid response format")
      return NextResponse.json(
        {
          success: true,
          results: [],
        },
        {
          headers,
        },
      )
    }

    const results = data.slice(1).map((entry: any[]) => {
      const [timestamp, original, statuscode, redirect] = entry
      const date = new Date(timestamp.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1-$2-$3 $4:$5:$6"))

      let resultString = `${date.toLocaleTimeString()} ${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} - `

      if (statuscode) {
        resultString += `${statuscode} - `
      }

      resultString += original

      if (redirect) {
        resultString += ` -> ${redirect}`
      }

      return resultString
    })

    console.log("Processed results, returning entries:", results.length)

    return NextResponse.json({ success: true, results }, { headers })
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    )
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: Request) {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  )
}

