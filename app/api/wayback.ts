import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { domain } = await req.json()

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    // Wayback Machine API endpoint
    const apiUrl = `https://web.archive.org/cdx/search/cdx?url=${domain}&output=json&fl=timestamp,original,statuscode,redirect`

    const response = await fetch(apiUrl)
    const data = await response.json()

    if (!response.ok) {
      throw new Error("Failed to fetch from Wayback Machine")
    }

    // Process the data
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

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error("API Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 },
    )
  }
}

