// Tambahkan middleware.js di root project untuk menangani CORS dan logging
import { NextResponse } from "next/server"

export function middleware(request) {
  console.log(`Middleware called for: ${request.nextUrl.pathname}`)

  // Tambahkan header CORS untuk semua response
  const response = NextResponse.next()

  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")

  return response
}

// Konfigurasi middleware untuk dijalankan pada path tertentu
export const config = {
  matcher: ["/api/:path*"],
}

