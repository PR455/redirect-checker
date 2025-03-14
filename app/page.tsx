"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"

export default function Home() {
  const [domain, setDomain] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState("")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [executionTime, setExecutionTime] = useState({
    seconds: "0.00",
    formatted: "00:00",
    ms: 0,
  })
  // Add state for running timer
  const [runningTimer, setRunningTimer] = useState({
    seconds: "0.00",
    formatted: "00:00",
  })
  // Add state for battle animation
  const [battleProgress, setBattleProgress] = useState(0)
  const [battleMessages, setBattleMessages] = useState<string[]>([])

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const battleIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const resultsContainerRef = useRef<HTMLDivElement>(null)
  const preserveTimerRef = useRef<boolean>(false)

  // Battle messages pool
  const attackMessages = [
    "Menyerang server target...",
    "Mengirim paket data...",
    "Mencari celah keamanan...",
    "Mengakses database Wayback...",
    "Menerobos firewall...",
    "Mengumpulkan informasi redirect...",
    "Menganalisis respons server...",
    "Memecahkan enkripsi data...",
    "Melacak riwayat domain...",
    "Mengekstrak data historis...",
    "Memetakan jalur redirect...",
    "Menyusup ke arsip web...",
    "Membongkar struktur domain...",
    "Mengidentifikasi pola redirect...",
    "Memproses data tersembunyi...",
  ]

  // Check system dark mode preference
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setIsDarkMode(true)
    }
  }, [])

  // Apply dark mode class to HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  // Cleanup timer interval when component unmounts
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current)
      }
    }
  }, [])

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode)
  }

  // Function to start the battle animation
  const startBattleAnimation = () => {
    // Reset battle state
    setBattleProgress(0)
    setBattleMessages([])

    // Clear any existing interval
    if (battleIntervalRef.current) {
      clearInterval(battleIntervalRef.current)
    }

    // Add initial message
    setBattleMessages(["Memulai serangan ke target..."])

    // Start interval to update battle animation
    battleIntervalRef.current = setInterval(() => {
      setBattleProgress((prev) => {
        // Random progress increment between 1-5%
        const increment = Math.floor(Math.random() * 5) + 1
        const newProgress = Math.min(prev + increment, 95) // Cap at 95% until complete

        // Add a new message occasionally
        if (Math.random() > 0.7) {
          const randomMessage = attackMessages[Math.floor(Math.random() * attackMessages.length)]
          setBattleMessages((prev) => [randomMessage, ...prev].slice(0, 5)) // Keep last 5 messages
        }

        return newProgress
      })
    }, 800)
  }

  // Function to stop the battle animation
  const stopBattleAnimation = (success = true) => {
    if (battleIntervalRef.current) {
      clearInterval(battleIntervalRef.current)
      battleIntervalRef.current = null
    }

    // Set to 100% on success, or stay at current value on failure
    if (success) {
      setBattleProgress(100)
      setBattleMessages((prev) => ["Serangan berhasil! Data ditemukan.", ...prev].slice(0, 5))
    } else {
      setBattleMessages((prev) => ["Serangan gagal! Target terlindungi.", ...prev].slice(0, 5))
    }
  }

  // Function to start the timer - modified to show only minutes and seconds
  const startTimer = () => {
    // Reset timer state
    setRunningTimer({
      seconds: "0.00",
      formatted: "00:00",
    })

    // Clear any existing interval
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }

    // Reset preserve flag when starting a new timer
    preserveTimerRef.current = false

    // Set start time
    startTimeRef.current = Date.now()

    // Start interval to update timer
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsedMs = Date.now() - startTimeRef.current
        const totalSeconds = Math.floor(elapsedMs / 1000)

        // Calculate minutes and seconds only (no hours)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60

        // Format as MM:SS
        const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        const secondsFormatted = (elapsedMs / 1000).toFixed(2)

        setRunningTimer({
          seconds: secondsFormatted,
          formatted: formatted,
        })
      }
    }, 100)
  }

  // Function to stop the timer
  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    // Set preserve flag to true when stopping the timer
    preserveTimerRef.current = true
  }

  // Add debugging to track the API response
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain.trim()) return

    setLoading(true)
    setError("")
    setResults([])

    // Start the timer when submitting
    startTimer()

    // Start battle animation
    startBattleAnimation()

    try {
      console.log("Submitting domain:", domain)

      const response = await fetch("/api/wayback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domain }),
      })

      const data = await response.json()
      console.log("API Response:", data)

      if (!response.ok) {
        throw new Error(data.error || data.details || "Failed to check domain")
      }

      if (!data.success) {
        throw new Error("API request failed")
      }

      // Stop the timer when results are received
      stopTimer()

      // Stop battle animation with success
      stopBattleAnimation(true)

      // Save the current timer value to execution time
      setExecutionTime({
        seconds: runningTimer.seconds,
        formatted: runningTimer.formatted,
        ms: startTimeRef.current ? Date.now() - startTimeRef.current : 0,
      })

      // Check if we have results
      if (data.results && Array.isArray(data.results)) {
        if (data.results.length === 0) {
          setError("No results found for this domain in the Wayback Machine archive.")
        } else {
          // Ensure we're setting the results correctly
          console.log("Setting results:", data.results)
          setResults(data.results)
        }
      } else if (data.messageChunks && Array.isArray(data.messageChunks)) {
        // Fallback to messageChunks if results is not available
        console.log("Using messageChunks:", data.messageChunks)
        setResults(data.messageChunks)
      } else {
        throw new Error("Invalid response format from server")
      }

      // Scroll to results after they load
      setTimeout(() => {
        if (resultsContainerRef.current) {
          resultsContainerRef.current.scrollIntoView({ behavior: "smooth" })
        }
      }, 100)
    } catch (err) {
      console.error("Error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")

      // Stop the timer on error
      stopTimer()

      // Stop battle animation with failure
      stopBattleAnimation(false)

      // Save the current timer value to execution time
      setExecutionTime({
        seconds: runningTimer.seconds,
        formatted: runningTimer.formatted,
        ms: startTimeRef.current ? Date.now() - startTimeRef.current : 0,
      })
    } finally {
      setLoading(false)
    }
  }

  // Enhanced color palette with more professional tones
  const colors = {
    // Base colors
    background: isDarkMode ? "#0a0e17" : "#f8fafc", // Darker background in dark mode
    cardBg: isDarkMode ? "#111827" : "#ffffff",
    primary: "#3b82f6", // More vibrant blue
    primaryHover: "#2563eb",
    primaryGlow: isDarkMode ? "0 0 15px rgba(59, 130, 246, 0.5)" : "none",

    // Text colors
    text: isDarkMode ? "#f3f4f6" : "#1e293b",
    textSecondary: isDarkMode ? "#9ca3af" : "#64748b",

    // UI elements
    border: isDarkMode ? "#1f2937" : "#e2e8f0",
    inputBg: isDarkMode ? "#1f2937" : "#ffffff",
    sectionBg: isDarkMode ? "#1e293b" : "#f1f5f9",

    // Results display
    redirectCard: isDarkMode ? "#1a2234" : "#ffffff",
    timestamp: isDarkMode ? "#9ca3af" : "#64748b",
    url: isDarkMode ? "#60a5fa" : "#2563eb",
    divider: isDarkMode ? "#1f2937" : "#e2e8f0",
    statusCode: isDarkMode ? "#4b5563" : "#e2e8f0",
    redirectArrow: isDarkMode ? "#60a5fa" : "#2563eb",
    yearHeader: isDarkMode ? "#d1d5db" : "#334155",

    // Alerts and notifications
    notFound: isDarkMode ? "#ef4444" : "#dc2626",
    notFoundBg: isDarkMode ? "rgba(239, 68, 68, 0.1)" : "rgba(220, 38, 38, 0.05)",
    success: isDarkMode ? "#10b981" : "#059669",
    successBg: isDarkMode ? "rgba(16, 185, 129, 0.1)" : "rgba(5, 150, 105, 0.05)",

    // Timer
    timerBg: isDarkMode ? "#1f2937" : "#f0f9ff",
    timerText: isDarkMode ? "#60a5fa" : "#2563eb",
    timerDigitBg: isDarkMode ? "#374151" : "#e0f2fe",
    timerDigitText: isDarkMode ? "#f8fafc" : "#0369a1",

    // Battle animation
    battleBg: isDarkMode ? "#1f2937" : "#f0f9ff",
    battleProgressBg: isDarkMode ? "#374151" : "#e0f2fe",
    battleProgressFill: "#3b82f6",
    battleText: isDarkMode ? "#9ca3af" : "#64748b",
    battleHighlight: isDarkMode ? "#f3f4f6" : "#1e293b",
  }

  // Helper function to parse timestamp entries
  const parseTimestampEntry = (entry: string) => {
    // Match timestamp pattern: HH:MM:SS Month DD, YYYY
    const timestampMatch = entry.match(/^(\d{2}:\d{2}:\d{2}\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})(.*)$/)

    if (timestampMatch) {
      const timestamp = timestampMatch[1].trim()
      const content = timestampMatch[2].trim()

      // Check if content contains redirect chain (multiple "->")
      const redirectChain = content.includes(" -> ")
      const redirectParts = redirectChain ? content.split(" -> ").map((part) => part.trim()) : []

      // Check if content contains "Not Found"
      const isNotFound = content.includes("Not Found")

      // Check if content contains a status code (like "301 - ")
      const hasStatusCode = /^\d{3}\s+-\s+/.test(content)

      return {
        timestamp,
        content,
        redirectChain,
        redirectParts,
        isNotFound,
        hasStatusCode,
      }
    }

    return null
  }

  // Enhanced Timer component with glowing effect
  const Timer = ({
    seconds,
    formattedTime,
    isRunning = false,
  }: { seconds: string; formattedTime: string; isRunning?: boolean }) => {
    const timeDigits = formattedTime.split("")

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1.25rem",
          backgroundColor: colors.timerBg,
          borderRadius: "0.75rem",
          marginBottom: "1.5rem",
          boxShadow: isRunning ? colors.primaryGlow : "none",
          transition: "all 0.3s ease",
          border: `1px solid ${isRunning ? colors.primary : colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: "0.875rem",
            color: isRunning ? colors.primary : colors.textSecondary,
            fontWeight: isRunning ? "600" : "400",
            letterSpacing: "0.025em",
          }}
        >
          {isRunning ? "EXECUTION TIME (RUNNING)" : "EXECUTION TIME"}
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.25rem",
            alignItems: "center",
            padding: "0.5rem 1rem",
            backgroundColor: isRunning ? "rgba(59, 130, 246, 0.1)" : "transparent",
            borderRadius: "0.5rem",
          }}
        >
          {timeDigits.map((digit, index) => {
            // Check if the digit is a colon
            const isColon = digit === ":"

            return (
              <div
                key={index}
                style={{
                  width: isColon ? "auto" : "2rem",
                  height: isColon ? "auto" : "2.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isColon ? "transparent" : colors.timerDigitBg,
                  color: isColon ? colors.timerText : colors.timerDigitText,
                  borderRadius: "0.375rem",
                  fontSize: "1.25rem",
                  fontWeight: isColon ? "normal" : "bold",
                  fontFamily: "monospace",
                  padding: isColon ? "0 0.25rem" : "0",
                  boxShadow: isRunning && !isColon ? "0 0 5px rgba(59, 130, 246, 0.5)" : "none",
                  transition: "all 0.3s ease",
                  border: isRunning && !isColon ? `1px solid ${colors.primary}` : "none",
                }}
              >
                {digit}
              </div>
            )
          })}
        </div>

        <div
          style={{
            fontSize: "0.875rem",
            color: colors.timerText,
            fontFamily: "monospace",
          }}
        >
          {Number.parseFloat(seconds).toFixed(2)} seconds
        </div>
      </div>
    )
  }

  // Battle Animation Component
  const BattleAnimation = ({ progress, messages }: { progress: number; messages: string[] }) => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          padding: "1.25rem",
          backgroundColor: colors.battleBg,
          borderRadius: "0.75rem",
          marginBottom: "1.5rem",
          border: `1px solid ${colors.border}`,
          boxShadow: progress < 100 ? colors.primaryGlow : "none",
          transition: "all 0.3s ease",
        }}
      >
        <div
          style={{
            fontSize: "0.875rem",
            color: colors.primary,
            fontWeight: "600",
            letterSpacing: "0.025em",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>BATTLE PROGRESS</span>
          <span>{progress}%</span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: "0.75rem",
            backgroundColor: colors.battleProgressBg,
            borderRadius: "0.375rem",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${progress}%`,
              backgroundColor: colors.battleProgressFill,
              borderRadius: "0.375rem",
              transition: "width 0.5s ease",
              boxShadow: "0 0 10px rgba(59, 130, 246, 0.7)",
            }}
          />

          {/* Animated glitch effect */}
          {progress < 100 && progress > 0 && (
            <>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${progress - 5}%`,
                  height: "100%",
                  width: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                  opacity: Math.random() > 0.7 ? 0.7 : 0,
                  transition: "opacity 0.1s ease",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: `${progress - 15}%`,
                  height: "100%",
                  width: "5px",
                  backgroundColor: "rgba(255, 255, 255, 0.5)",
                  opacity: Math.random() > 0.8 ? 0.5 : 0,
                  transition: "opacity 0.1s ease",
                }}
              />
            </>
          )}
        </div>

        {/* Battle messages */}
        <div
          style={{
            marginTop: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            maxHeight: "100px",
            overflowY: "auto",
          }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                color: index === 0 ? colors.battleHighlight : colors.battleText,
                padding: "0.375rem 0.5rem",
                backgroundColor: index === 0 ? "rgba(59, 130, 246, 0.1)" : "transparent",
                borderRadius: "0.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ color: colors.primary }}>{">"}</span>
              {message}
              {index === 0 && progress < 100 && (
                <span
                  style={{
                    display: "inline-block",
                    width: "0.5rem",
                    height: "1rem",
                    backgroundColor: colors.primary,
                    animation: "blink 1s infinite",
                    marginLeft: "0.25rem",
                  }}
                ></span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Enhanced formatResults function with better styling
  const formatResults = () => {
    if (!results || results.length === 0) {
      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: colors.textSecondary,
            backgroundColor: colors.sectionBg,
            borderRadius: "0.75rem",
            margin: "1rem 0",
            border: `1px solid ${colors.border}`,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: "0 auto 1rem", opacity: 0.5 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontWeight: "500" }}>No results found</p>
          <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
            The domain may not have any recorded redirects or snapshots in the Wayback Machine archive.
          </p>
        </div>
      )
    }

    // Log the results for debugging
    console.log("Rendering results:", results)

    // Enhanced display of results with better formatting
    return (
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          backgroundColor: colors.sectionBg,
          borderRadius: "0.75rem",
          color: colors.text,
          maxHeight: "600px",
          overflow: "auto",
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            padding: "1rem",
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.primary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>Wayback Machine Data</span>
        </div>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            padding: "1rem",
            margin: 0,
          }}
        >
          {results.join("\n")}
        </pre>
      </div>
    )
  }

  // Determine which timer value to display
  const displayTimer = () => {
    if (loading) {
      // When loading, show the running timer
      return {
        seconds: runningTimer.seconds,
        formatted: runningTimer.formatted,
        isRunning: true,
      }
    } else if (preserveTimerRef.current && runningTimer.formatted !== "00:00") {
      // When finished but we want to preserve the timer value
      return {
        seconds: runningTimer.seconds,
        formatted: runningTimer.formatted,
        isRunning: false,
      }
    } else {
      // Default to execution time (which might be from a previous run)
      return {
        seconds: executionTime.seconds,
        formatted: executionTime.formatted,
        isRunning: false,
      }
    }
  }

  // Get the current timer display values
  const timerDisplay = displayTimer()

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.background,
        padding: "2rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: colors.text,
        transition: "all 0.3s ease",
        backgroundImage: isDarkMode
          ? "radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)"
          : "none",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "48rem",
          backgroundColor: colors.cardBg,
          borderRadius: "1rem",
          boxShadow: isDarkMode
            ? "0 4px 20px -2px rgba(0, 0, 0, 0.3), 0 8px 16px -4px rgba(0, 0, 0, 0.2)"
            : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
          overflow: "hidden",
          transition: "all 0.3s ease",
          marginBottom: "2rem",
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Logo/Image with enhanced styling */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            margin: "1.5rem auto",
            padding: "0 1.5rem",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: isDarkMode
                ? "radial-gradient(circle at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%)"
                : "none",
              pointerEvents: "none",
            }}
          ></div>
          <img
            src="https://ik.imagekit.io/pfueho1dr/bajakteamlogo.png"
            alt="BajakTeam303 Logo"
            style={{
              maxWidth: "70%",
              height: "auto",
              borderRadius: "0.75rem",
              boxShadow: isDarkMode ? "0 0 20px rgba(59, 130, 246, 0.2)" : "none",
            }}
          />
        </div>

        {/* Header with enhanced styling */}
        <div
          style={{
            padding: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: "2.75rem",
                height: "2.75rem",
                backgroundColor: colors.primary,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                boxShadow: isDarkMode ? "0 0 15px rgba(59, 130, 246, 0.5)" : "none",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l4 2" />
              </svg>
            </div>
            <div>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "700",
                  margin: "0",
                  color: colors.text,
                  letterSpacing: "-0.025em",
                }}
              >
                Redirect Checker
              </h1>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: colors.textSecondary,
                  margin: "0.25rem 0 0 0",
                }}
              >
                <span style={{ color: colors.primary, fontWeight: "500" }}>BajakTeam303</span> - Check domain redirects
                using Wayback Machine
              </p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            style={{
              background: isDarkMode ? "rgba(59, 130, 246, 0.1)" : "rgba(241, 245, 249, 0.8)",
              border: `1px solid ${isDarkMode ? "rgba(59, 130, 246, 0.2)" : colors.border}`,
              padding: "0.75rem",
              cursor: "pointer",
              color: colors.textSecondary,
              borderRadius: "0.5rem",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? "rgba(59, 130, 246, 0.2)" : "#f1f5f9"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode
                ? "rgba(59, 130, 246, 0.1)"
                : "rgba(241, 245, 249, 0.8)"
            }}
          >
            {isDarkMode ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "1.5rem",
          }}
        >
          {/* Always display timer */}
          <div style={{ marginBottom: "1.5rem" }}>
            <Timer
              seconds={timerDisplay.seconds}
              formattedTime={timerDisplay.formatted}
              isRunning={timerDisplay.isRunning}
            />
          </div>

          {/* Battle animation when loading */}
          {loading && <BattleAnimation progress={battleProgress} messages={battleMessages} />}

          <form onSubmit={handleSubmit}>
            <div
              style={{
                position: "relative",
                marginBottom: "1rem",
              }}
            >
              <input
                type="text"
                placeholder="Enter domain (e.g. example.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                style={{
                  width: "100%",
                  height: "3rem",
                  paddingLeft: "3rem",
                  paddingRight: "3rem",
                  fontSize: "0.875rem",
                  borderRadius: "0.75rem",
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  outline: "none",
                  transition: "all 0.3s ease",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = colors.primary
                  e.target.style.boxShadow = isDarkMode
                    ? "0 0 0 1px rgba(59, 130, 246, 0.3), 0 1px 2px rgba(0, 0, 0, 0.05)"
                    : "0 0 0 1px rgba(59, 130, 246, 0.3), 0 1px 2px rgba(0, 0, 0, 0.05)"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border
                  e.target.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "1.5rem",
                  height: "1.5rem",
                  color: colors.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              {domain && (
                <button
                  type="button"
                  onClick={() => setDomain("")}
                  style={{
                    position: "absolute",
                    right: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: "0.25rem",
                    cursor: "pointer",
                    color: colors.textSecondary,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !domain.trim()}
              style={{
                width: "100%",
                height: "3rem",
                backgroundColor: colors.primary,
                color: "white",
                fontSize: "0.875rem",
                fontWeight: "600",
                borderRadius: "0.75rem",
                border: "none",
                cursor: loading || !domain.trim() ? "not-allowed" : "pointer",
                opacity: loading || !domain.trim() ? "0.7" : "1",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: isDarkMode
                  ? "0 0 15px rgba(59, 130, 246, 0.3)"
                  : "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
              }}
              onMouseOver={(e) => {
                if (!loading && domain.trim()) {
                  e.currentTarget.style.backgroundColor = colors.primaryHover
                  e.currentTarget.style.boxShadow = isDarkMode
                    ? "0 0 20px rgba(59, 130, 246, 0.4)"
                    : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = colors.primary
                e.currentTarget.style.boxShadow = isDarkMode
                  ? "0 0 15px rgba(59, 130, 246, 0.3)"
                  : "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)"
              }}
            >
              {loading ? (
                <>
                  <div
                    style={{
                      width: "1.25rem",
                      height: "1.25rem",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid white",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <span>CHECKING DOMAIN...</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                  <span>LAUNCH ATTACK</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                backgroundColor: isDarkMode ? "rgba(239, 68, 68, 0.1)" : "#fee2e2",
                color: "#ef4444",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginTop: "0.125rem", flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>Attack Failed</div>
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Footer with enhanced styling */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: isDarkMode ? "rgba(31, 41, 55, 0.5)" : "rgba(241, 245, 249, 0.5)",
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              color: colors.textSecondary,
              fontWeight: "500",
              letterSpacing: "0.05em",
            }}
          >
            TEAM303
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.75rem",
                color: colors.primary,
                fontWeight: "600",
              }}
            >
              ELITE
            </span>
            <div
              style={{
                width: "0.5rem",
                height: "0.5rem",
                backgroundColor: colors.success,
                borderRadius: "50%",
                boxShadow: "0 0 5px rgba(16, 185, 129, 0.7)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Loading indicator with enhanced styling */}
      {loading && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem 1.5rem",
            color: colors.text,
            borderRadius: "0.75rem",
            fontSize: "0.975rem",
            backgroundColor: isDarkMode ? "rgba(31, 41, 55, 0.7)" : "rgba(241, 245, 249, 0.8)",
            border: `1px solid ${colors.border}`,
            boxShadow: isDarkMode ? "0 0 15px rgba(59, 130, 246, 0.2)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.primary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: "pulse 2s infinite" }}
          >
            <path d="M10.308 5H5v5.308l7.077 7.077 5.308-5.308-7.077-7.077Z" />
            <path d="m13.5 2.5 2 2" />
            <path d="m10 5.5 2 2" />
            <path d="m2 11.5 2 2" />
            <path d="m16 11.5 2 2" />
            <path d="m13.5 16.5 2 2" />
          </svg>
          <p style={{ margin: 0, fontWeight: "500" }}>
            <span style={{ color: colors.primary }}>ATTACKING TARGET</span> - THIS PROCESS MAY TAKE SEVERAL MINUTES...
          </p>
        </div>
      )}

      {/* Results container with enhanced styling */}
      {!loading && results.length > 0 && (
        <div
          ref={resultsContainerRef}
          style={{
            width: "100%",
            maxWidth: "48rem",
            backgroundColor: colors.cardBg,
            borderRadius: "1rem",
            boxShadow: isDarkMode
              ? "0 4px 20px -2px rgba(0, 0, 0, 0.3), 0 8px 16px -4px rgba(0, 0, 0, 0.2)"
              : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
            overflow: "hidden",
            transition: "all 0.3s ease",
            marginBottom: "2rem",
            marginTop: "2rem",
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              padding: "1.5rem",
              borderBottom: `1px solid ${colors.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: isDarkMode ? "rgba(59, 130, 246, 0.1)" : "rgba(241, 245, 249, 0.8)",
            }}
          >
            <h2
              style={{
                fontSize: "1.125rem",
                fontWeight: "700",
                margin: "0",
                color: colors.text,
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "2rem",
                  height: "2rem",
                  backgroundColor: colors.success,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  boxShadow: isDarkMode ? "0 0 10px rgba(16, 185, 129, 0.5)" : "none",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <span>
                Attack Successful: <span style={{ color: colors.primary }}>{domain}</span>
              </span>
            </h2>
            <div
              style={{
                fontSize: "0.75rem",
                color: colors.textSecondary,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: isDarkMode ? "rgba(31, 41, 55, 0.5)" : "rgba(255, 255, 255, 0.8)",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                border: `1px solid ${colors.border}`,
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Wayback Machine Results</span>
            </div>
          </div>
          <div
            style={{
              padding: "1.5rem",
              maxHeight: "700px",
              overflowY: "auto",
              boxShadow: isDarkMode ? "inset 0 2px 4px rgba(0,0,0,0.2)" : "inset 0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            {formatResults()}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        body {
          margin: 0;
          padding: 0;
        }
        
        .dark {
          color-scheme: dark;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: ${isDarkMode ? "#1a2234" : "#f1f5f9"};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? "#334155" : "#cbd5e1"};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? "#475569" : "#94a3b8"};
        }
      `}</style>
    </div>
  )
}

