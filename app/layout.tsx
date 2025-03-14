import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { ThemeProvider } from "../components/theme-provider"

export const metadata: Metadata = {
  title: "Redirect Checker - BajakTeam303",
  description: "Check domain redirects using Wayback Machine",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

