// Enhanced Wayback Machine Redirect Checker
// Optimized to focus only on 3XX redirects with improved performance

// Timer implementation
const timer = {
  startTime: null,
  endTime: null,
  elapsedTimeMs: 0,
  intervalId: null,
  listeners: [],

  start: function () {
    this.startTime = performance.now()
    this.endTime = null
    this.elapsedTimeMs = 0

    // Clear any existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    // Update elapsed time every 100ms
    this.intervalId = setInterval(() => {
      this.elapsedTimeMs = performance.now() - this.startTime
      this.notifyListeners()
    }, 100)

    return this.startTime
  },

  stop: function () {
    this.endTime = performance.now()
    this.elapsedTimeMs = this.endTime - this.startTime

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.notifyListeners()
    return this.elapsedTimeMs
  },

  reset: function () {
    this.startTime = null
    this.endTime = null
    this.elapsedTimeMs = 0

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.notifyListeners()
  },

  getElapsedTime: function () {
    if (!this.startTime) return 0

    if (this.endTime) {
      return this.elapsedTimeMs
    }

    return performance.now() - this.startTime
  },

  // Get formatted time as seconds with two decimal places
  getElapsedTimeFormatted: function () {
    const timeMs = this.getElapsedTime()
    const seconds = (timeMs / 1000).toFixed(2)
    return seconds
  },

  // Get formatted time as hours:minutes:seconds
  getElapsedTimeFormattedHMS: function () {
    const timeMs = this.getElapsedTime()
    const totalSeconds = Math.floor(timeMs / 1000)

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  },

  addListener: function (callback) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback)
    }
  },

  notifyListeners: function () {
    for (const listener of this.listeners) {
      listener(this.getElapsedTimeFormatted(), this.getElapsedTimeFormattedHMS())
    }
  },
}

// Simple in-memory cache implementation
const cache = {
  data: {},
  get: function (key) {
    const item = this.data[key]
    if (!item) return null

    // Check if cache item has expired
    if (item.expiry && item.expiry < Date.now()) {
      delete this.data[key]
      return null
    }

    return item.value
  },
  set: function (key, value, ttlSeconds = 3600) {
    // Default TTL: 1 hour
    this.data[key] = {
      value: value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    }
  },
  has: function (key) {
    return this.get(key) !== null
  },
  invalidate: function (keyPattern) {
    // Clear cache entries that match a pattern
    const regex = new RegExp(keyPattern)
    Object.keys(this.data).forEach((key) => {
      if (regex.test(key)) {
        delete this.data[key]
      }
    })
  },
  stats: function () {
    return {
      size: Object.keys(this.data).length,
      keys: Object.keys(this.data),
    }
  },
}

// Network health monitoring
const networkMonitor = {
  consecutiveErrors: 0,
  errorThreshold: 5, // Number of consecutive errors before suggesting VPN change
  lastErrorTime: null,
  cooldownPeriod: 60000, // 1 minute cooldown between warnings
  lastWarningTime: null,

  recordError: function () {
    this.consecutiveErrors++
    this.lastErrorTime = Date.now()

    if (this.consecutiveErrors >= this.errorThreshold) {
      const currentTime = Date.now()
      // Only show warning if we're not in cooldown period
      if (!this.lastWarningTime || currentTime - this.lastWarningTime > this.cooldownPeriod) {
        console.log("\n⚠️ NETWORK ISSUE DETECTED ⚠️")
        console.log("Multiple consecutive errors occurred. This might be due to:")
        console.log("1. Wayback Machine rate limiting your current IP address")
        console.log("2. Network connectivity issues")
        console.log("3. VPN-related connection problems")
        console.log("\nSuggested actions:")
        console.log("- Wait a few minutes before trying again")
        console.log("- Change your VPN connection or IP address")
        console.log("- Reduce the number of concurrent requests\n")

        this.lastWarningTime = currentTime
      }
    }
  },

  recordSuccess: function () {
    // Reset consecutive errors counter on success
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = 0
    }
  },

  isHealthy: function () {
    return this.consecutiveErrors < this.errorThreshold
  },

  reset: function () {
    this.consecutiveErrors = 0
    this.lastErrorTime = null
  },
}

async function checkDomainHistory(domain) {
  const logs = [] // For final results displayed in browser
  const debugLogs = [] // For process logs only displayed in console
  const messageChunks = [] // For splitting long messages into chunks
  const MAX_CHUNK_SIZE = 3800 // Slightly less than Telegram's 4096 limit to be safe

  // Start the timer
  timer.reset()
  timer.start()

  // Log the start time
  const startTime = new Date().toISOString()

  // Function to add debug log (console/CMD only)
  const addDebugLog = (message) => {
    debugLogs.push(message)
    console.log(message) // Only displayed in console/CMD
  }

  // Function to add result log (displayed in browser and console)
  const addResultLog = (message) => {
    logs.push(message)
    console.log(message) // Also displayed in console/CMD
  }

  // Configuration
  const BASE_URL = "https://web.archive.org"
  const MAX_RETRIES = 5
  const INITIAL_BACKOFF = 2000
  const MAX_BACKOFF = 30000
  const TIMEOUT = 60000 // Reduced from 180000 to 60000 ms (1 minute) for faster execution
  const MAX_REDIRECT_CHAIN = 5

  // Removing snapshot limits to check ALL snapshots
  const MAX_SNAPSHOTS_TO_CHECK = 1000 // Reduced from Infinity to 1000 for better performance
  const MAX_SNAPSHOTS_PER_REQUEST = 2000 // Reduced from Infinity to 2000 for better performance

  // Configuration for parallelization - REDUCED for better stability
  const MAX_CONCURRENT_REQUESTS = 5 // Increased from 3 to 5 for faster execution
  const REQUEST_DELAY_MS = 200 // Reduced from 300 to 200 ms for faster execution

  // List of domains to ignore (false positives)
  const IGNORED_DOMAINS = ["w3.org", "google.com", "facebook.com", "twitter.com", "instagram.com"]

  // List of common service domains to ignore
  const COMMON_SERVICE_DOMAINS = [
    "google",
    "facebook",
    "twitter",
    "instagram",
    "youtube",
    "linkedin",
    "github",
    "amazonaws",
    "cloudfront",
    "cdn",
    "analytics",
    "tracking",
    "stats",
    "ads",
    "doubleclick",
    "google-analytics",
    "googletagmanager",
    "hotjar",
    "jquery",
    "cloudflare",
    "googleapis",
    "gstatic",
  ]

  // Define URLs to check - main domain and common variations
  const urlsToCheck = [
    `http://${domain}/`,
    `https://${domain}/`,
    `http://www.${domain}/`,
    `https://${domain}/`,
    `http://${domain}/index.html`,
    `http://${domain}/index.php`,
    `http://${domain}:80/`,
    `https://${domain}:443/`,
  ]

  // Reset network monitor at the start of each domain check
  networkMonitor.reset()

  addDebugLog(`Starting redirect check for domain: ${domain} at ${startTime}`)

  // Helper for parallel processing of arrays with adaptive concurrency
  async function processInParallel(
    items,
    processFn,
    maxConcurrent = MAX_CONCURRENT_REQUESTS,
    delayMs = REQUEST_DELAY_MS,
  ) {
    const results = []
    const inProgress = new Set()
    let consecutiveErrors = 0

    // Adaptive concurrency based on network health
    const getAdaptiveConcurrency = () => {
      if (consecutiveErrors >= 3) {
        // Reduce concurrency when experiencing multiple errors
        return Math.max(1, Math.floor(maxConcurrent / 2))
      }
      return maxConcurrent
    }

    async function processItem(item, index) {
      try {
        inProgress.add(index)
        const result = await processFn(item)
        results[index] = result

        // Reset consecutive errors on success
        consecutiveErrors = 0
        networkMonitor.recordSuccess()
      } catch (error) {
        results[index] = null
        addDebugLog(`Error processing item ${index}: ${error.message}`)

        // Track consecutive errors
        consecutiveErrors++
        networkMonitor.recordError()

        // If we're experiencing many errors, add extra delay
        if (consecutiveErrors >= 3) {
          const extraDelay = Math.min(1000 * consecutiveErrors, 10000)
          addDebugLog(`Adding extra delay of ${extraDelay}ms due to consecutive errors`)
          await sleep(extraDelay)
        }
      } finally {
        inProgress.delete(index)
      }
    }

    for (let i = 0; i < items.length; i++) {
      // Check if we should pause processing due to network issues
      if (!networkMonitor.isHealthy()) {
        addDebugLog(`Pausing processing for 30 seconds due to network issues...`)
        await sleep(30000) // 30 second pause
        networkMonitor.reset() // Reset after pause
      }

      // Get adaptive concurrency based on current conditions
      const currentMaxConcurrent = getAdaptiveConcurrency()

      // Wait if we've reached max concurrent requests
      while (inProgress.size >= currentMaxConcurrent) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Process next item
      processItem(items[i], i)

      // Add delay between starting new requests
      if (delayMs > 0) {
        // Add extra delay if we're experiencing errors
        const adaptiveDelay = delayMs * (1 + consecutiveErrors * 0.5)
        await new Promise((resolve) => setTimeout(resolve, adaptiveDelay))
      }
    }

    // Wait for all requests to complete
    while (inProgress.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return results
  }

  // Function to perform request with exponential backoff, caching, and error handling
  async function requestWithRetry(url, options = {}, acceptableStatusCodes = [200], cacheKey = null, cacheTtl = 3600) {
    // Check cache first if cacheKey provided
    if (cacheKey && cache.has(cacheKey)) {
      addDebugLog(`Cache hit for ${cacheKey}`)
      return cache.get(cacheKey)
    }

    let retries = 0
    let backoff = INITIAL_BACKOFF

    // List of varied User-Agents to avoid bot detection
    const userAgents = [
      // Desktop browsers - Chrome
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",

      // Desktop browsers - Firefox
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0",
      "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",

      // Desktop browsers - Safari
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",

      // Desktop browsers - Edge
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ]

    while (retries < MAX_RETRIES) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

        // Choose a random User-Agent
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

        // Add header variations to avoid bot detection
        const headers = {
          "User-Agent": randomUserAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          DNT: "1",
          ...(options.headers || {}),
        }

        // Add random delay to avoid detection patterns
        const randomDelay = Math.floor(Math.random() * 300) // Reduced from 500 to 300ms
        if (randomDelay > 0) {
          await sleep(randomDelay)
        }

        const response = await fetch(url, {
          ...options,
          headers,
          redirect: "follow", // Follow redirects automatically
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId))

        // Accept status codes considered successful
        if (acceptableStatusCodes.includes(response.status)) {
          // Record successful request
          networkMonitor.recordSuccess()

          // Clone response for caching
          const responseClone = response.clone()

          // For JSON responses
          if (response.headers.get("content-type")?.includes("application/json")) {
            const data = await response.json()

            // Cache the result if cacheKey provided
            if (cacheKey) {
              cache.set(
                cacheKey,
                {
                  json: () => Promise.resolve(data),
                  text: () => Promise.resolve(JSON.stringify(data)),
                  status: response.status,
                  headers: new Map(response.headers),
                  ok: response.ok,
                  clone: () => {
                    return {
                      json: () => Promise.resolve(data),
                      text: () => Promise.resolve(JSON.stringify(data)),
                      status: response.status,
                      headers: new Map(response.headers),
                      ok: response.ok,
                    }
                  },
                },
                cacheTtl,
              )
            }

            return {
              json: () => Promise.resolve(data),
              text: () => Promise.resolve(JSON.stringify(data)),
              status: response.status,
              headers: response.headers,
              ok: response.ok,
              clone: () => responseClone,
            }
          }

          // For text/HTML responses
          const text = await response.text()

          // Cache the result if cacheKey provided
          if (cacheKey) {
            cache.set(
              cacheKey,
              {
                text: () => Promise.resolve(text),
                json: () => Promise.reject(new Error("Not a JSON response")),
                status: response.status,
                headers: new Map(response.headers),
                ok: response.ok,
                clone: () => {
                  return {
                    text: () => Promise.resolve(text),
                    json: () => Promise.reject(new Error("Not a JSON response")),
                    status: response.status,
                    headers: new Map(response.headers),
                    ok: response.ok,
                  }
                },
              },
              cacheTtl,
            )
          }

          return {
            text: () => Promise.resolve(text),
            json: () => Promise.reject(new Error("Not a JSON response")),
            status: response.status,
            headers: response.headers,
            ok: response.ok,
            clone: () => responseClone,
          }
        } else {
          // Record error for network monitoring
          networkMonitor.recordError()

          throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        retries++

        // Record error for network monitoring
        networkMonitor.recordError()

        const errorMessage =
          error.name === "AbortError" ? "Request timeout - Wayback Machine is responding slowly" : error.message

        addDebugLog(`Attempt ${retries}/${MAX_RETRIES} failed: ${errorMessage}`)

        if (retries >= MAX_RETRIES) {
          throw new Error(
            `Failed after ${MAX_RETRIES} attempts: The Wayback Machine is responding very slowly. Please try again later.`,
          )
        }

        // Exponential backoff with jitter
        backoff = Math.min(backoff * 1.5 * (1 + Math.random() * 0.2), MAX_BACKOFF)
        addDebugLog(`Waiting ${Math.round(backoff / 1000)} seconds before retrying...`)

        // Use sleep function to wait
        await sleep(backoff)
      }
    }

    throw new Error("Maximum retry attempts exceeded")
  }

  // Simple sleep function
  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Format Wayback Machine timestamp to readable date
  function formatWaybackTimestamp(timestamp) {
    if (!timestamp || timestamp.length < 14) return "Unknown date"

    const year = timestamp.substring(0, 4)
    const month = timestamp.substring(4, 6)
    const day = timestamp.substring(6, 8)
    const hour = timestamp.substring(8, 10)
    const minute = timestamp.substring(10, 12)
    const second = timestamp.substring(12, 14)

    // Format according to example: 05:37:35 March 26, 2024
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    const monthName = monthNames[Number.parseInt(month, 10) - 1]

    return `${hour}:${minute}:${second} ${monthName} ${day}, ${year}`
  }

  // Extract domain from URL
  function extractDomain(url) {
    try {
      // Add https:// if no protocol
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url
      }
      const hostname = new URL(url).hostname
      // Remove 'www.' if present
      return hostname.replace(/^www\./, "")
    } catch (e) {
      return url
    }
  }

  // Extract path from URL
  function extractPath(url) {
    try {
      // Add https:// if no protocol
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url
      }
      const urlObj = new URL(url)
      return urlObj.pathname + urlObj.search
    } catch (e) {
      return "/"
    }
  }

  // Function to check if URL is main domain (without specific path)
  function isMainDomainUrl(url) {
    try {
      if (!url.startsWith("http")) url = "http://" + url
      const urlObj = new URL(url)

      // Remove trailing slash if present
      let path = urlObj.pathname
      if (path.endsWith("/")) path = path.slice(0, -1)

      // Main domain only has "/" as path or "/index.html" or empty
      const isMainPath = path === "" || path === "/" || /^\/(index\.(html|php|asp|jsp))?$/.test(path)

      // No query string or fragment
      const hasNoQuery = urlObj.search === ""
      const hasNoFragment = urlObj.hash === ""

      return isMainPath && hasNoQuery && hasNoFragment
    } catch (e) {
      return false
    }
  }

  // Function to check if two URLs only differ in protocol (http/https) or www
  function isProtocolOrWwwDifference(url1, url2) {
    try {
      // Normalize URLs
      if (!url1.startsWith("http")) url1 = "http://" + url1
      if (!url2.startsWith("http")) url2 = "http://" + url2

      const urlObj1 = new URL(url1)
      const urlObj2 = new URL(url2)

      // Check if either URL has explicit port
      if ((url1.includes(":") && url1.split(":")[2]) || (url2.includes(":") && url2.split(":")[2])) {
        addDebugLog(`🔍 Found explicit port in URL: ${url1} or ${url2}`)
        return false
      }

      // Extract hostname without www
      const hostname1 = urlObj1.hostname.replace(/^www\./, "")
      const hostname2 = urlObj2.hostname.replace(/^www\./, "")

      // If base hostnames differ, not a minor difference
      if (hostname1 !== hostname2) {
        return false
      }

      // Check if path and query string are the same
      const path1 = urlObj1.pathname + urlObj1.search
      const path2 = urlObj2.pathname + urlObj2.search

      // If paths differ, not a minor difference
      if (path1 !== path2) {
        return false
      }

      // If we get here, the difference is only in protocol or www
      addDebugLog(`⚠️ URL ignored because it only differs in protocol or www: ${url1} → ${url2}`)
      return true
    } catch (e) {
      addDebugLog(`Error in isProtocolOrWwwDifference: ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }

  // Function to check if target URL contains original domain as parameter
  function containsOriginalDomainAsParameter(targetUrl, originalDomain) {
    try {
      const url = new URL(targetUrl)
      const searchParams = url.searchParams.toString().toLowerCase()
      const pathname = url.pathname.toLowerCase()

      // Remove www. if present
      const cleanOriginalDomain = originalDomain.replace(/^www\./, "")

      // Check if original domain exists in URL parameters
      return searchParams.includes(cleanOriginalDomain) || pathname.includes(cleanOriginalDomain)
    } catch (e) {
      return false
    }
  }

  // Function to check if redirect target is valid
  function isValidRedirectTarget(targetUrl, originalUrl) {
    try {
      // Normalize URLs
      if (!targetUrl.startsWith("http")) targetUrl = "http://" + targetUrl
      if (!originalUrl.startsWith("http")) originalUrl = "http://" + originalUrl

      // Check for explicit port before creating URL object
      const hasExplicitPort = (url) => {
        // Check if URL has explicit port (format: protocol://domain:port/)
        const portMatch = url.match(/^https?:\/\/[^/]+:(\d+)/i)
        return portMatch !== null
      }

      // Extract domain and path from URL
      const targetDomain = extractDomain(targetUrl)
      const originalDomain = extractDomain(originalUrl)
      const targetPath = extractPath(targetUrl)
      const originalPath = extractPath(originalUrl)

      // Check if original URL is main domain (without specific path)
      if (!isMainDomainUrl(originalUrl)) {
        addDebugLog(`⚠️ Original URL is not main domain, ignored: ${originalUrl}`)
        return false
      }

      // If target URL has explicit port, this is a valid redirect
      if (hasExplicitPort(targetUrl)) {
        const port = targetUrl.match(/^https?:\/\/[^/]+:(\d+)/i)?.[1]
        addDebugLog(`✅ Found redirect to explicit port: ${targetUrl} (port: ${port})`)
        return true
      }

      // Check if this is only a protocol (http/https) or www difference
      if (isProtocolOrWwwDifference(originalUrl, targetUrl)) {
        return false
      }

      // Check if original domain exists in target URL parameters
      if (containsOriginalDomainAsParameter(targetUrl, originalDomain)) {
        addDebugLog(`⚠️ URL ignored because it contains original domain as parameter: ${targetUrl}`)
        return false
      }

      // Check if target domain is in ignored list
      if (
        IGNORED_DOMAINS.some(
          (ignoredDomain) => targetDomain === ignoredDomain || targetDomain.endsWith("." + ignoredDomain),
        )
      ) {
        addDebugLog(`⚠️ URL ignored because target domain is in ignored list: ${targetDomain}`)
        return false
      }

      // Case 1: Redirect to different domain
      if (
        targetDomain !== originalDomain &&
        !targetDomain.endsWith("." + originalDomain) &&
        !originalDomain.endsWith("." + targetDomain)
      ) {
        addDebugLog(`✅ Found redirect to different domain: ${targetDomain}`)
        return true
      }

      // Case 2: Redirect to subdomain
      if (targetDomain.endsWith("." + originalDomain) && targetDomain !== "www." + originalDomain) {
        addDebugLog(`✅ Found redirect to subdomain: ${targetDomain}`)
        return true
      }

      // Case 3: Redirect to parent domain
      if (originalDomain.endsWith("." + targetDomain) && originalDomain !== "www." + targetDomain) {
        addDebugLog(`✅ Found redirect to parent domain: ${targetDomain}`)
        return true
      }

      // Case 4: Redirect to different URL/page on same domain
      if (targetDomain === originalDomain && targetPath !== originalPath) {
        // Check if target path is main subdirectory (without file extension)
        const isSubdirectory = targetPath.indexOf(".") === -1 && !targetPath.includes("?") && !targetPath.includes("#")

        if (isSubdirectory) {
          addDebugLog(`✅ Found redirect to main subdirectory: ${targetPath}`)
          return true
        } else {
          addDebugLog(`⚠️ Ignored redirect to specific page: ${targetPath}`)
          return false
        }
      }

      // If no case matches, not a valid redirect
      addDebugLog(`⚠️ Not a valid redirect: ${targetUrl}`)
      return false
    } catch (error) {
      addDebugLog(`Error checking redirect validity: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  // Helper function untuk normalisasi URL
  function normalizeUrl(url, originalUrl) {
    try {
      // Jika URL relatif, gabungkan dengan domain asli
      if (url.startsWith("/")) {
        const domain = extractDomain(originalUrl)
        url = `http://${domain}${url}`
      } else if (!url.startsWith("http")) {
        url = `http://${url}`
      }

      return url
    } catch (e) {
      return url
    }
  }

  // Function to detect client-side redirects in page content
  async function detectClientSideRedirects(html, originalUrl) {
    // Create cache key for client-side redirect detection
    const cacheKey = `client-side-redirect:${originalUrl}:${html.length}`

    // Check cache
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)
    }

    try {
      const redirectInfo = {
        found: false,
        type: null,
        targetUrl: null,
        delay: null,
        message: null,
      }

      // 1. Improved regex for JavaScript redirect detection
      const jsRedirectPatterns = [
        // window.location patterns
        /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
        /window\.location\.replace$$["']([^"']+)["']$$/i,

        // window.location.assign patterns
        /window\.location\.assign$$["']([^"']+)["']$$/i,

        // document.location patterns
        /document\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
        /document\.location\.replace$$["']([^"']+)["']$$/i,

        // top.location patterns
        /top\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,

        // self.location patterns
        /self\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
      ]

      // 2. Improved regex for setTimeout with redirect
      const setTimeoutPatterns = [
        // Basic setTimeout with redirect
        /setTimeout\s*$$\s*function\s*\(\s*$$\s*\{[^}]*(?:location|window|document)\.(?:location|href)\s*=\s*["']([^"']+)["'][^}]*\}\s*,\s*(\d+)\s*\)/is,

        // setTimeout with arrow function
        /setTimeout\s*$$\s*\(\s*$$\s*=>\s*\{[^}]*(?:location|window|document)\.(?:location|href)\s*=\s*["']([^"']+)["'][^}]*\}\s*,\s*(\d+)\s*\)/is,

        // setTimeout with direct function
        /setTimeout\s*$$\s*["'](?:location|window|document)\.(?:location|href)\s*=\s*\\?["']([^"']+)\\?["'][\s"']*\s*,\s*(\d+)\s*$$/is,
      ]

      // 3. Check for meta refresh with delay
      const metaRefreshRegex =
        /<meta\s+http-equiv=["']?refresh["']?\s+content=["']?(\d+)(?:;\s*url=([^"'>]+))?["']?\s*\/?>/i
      const metaRefreshMatch = html.match(metaRefreshRegex)

      if (metaRefreshMatch) {
        const delay = Number.parseInt(metaRefreshMatch[1], 10)
        let targetUrl = metaRefreshMatch[2] || originalUrl

        // Normalize target URL
        targetUrl = normalizeUrl(targetUrl, originalUrl)

        redirectInfo.found = true
        redirectInfo.type = "meta-refresh"
        redirectInfo.targetUrl = targetUrl
        redirectInfo.delay = delay
        redirectInfo.message = `Meta refresh redirect to ${targetUrl} after ${delay} seconds`

        addDebugLog(`✅ Found meta refresh redirect: ${delay}s delay to ${targetUrl}`)

        // Cache the result
        cache.set(cacheKey, redirectInfo, 3600)
        return redirectInfo
      }

      // 4. Check JavaScript redirects
      for (const pattern of jsRedirectPatterns) {
        const match = html.match(pattern)
        if (match) {
          let targetUrl = match[1]
          targetUrl = normalizeUrl(targetUrl, originalUrl)

          redirectInfo.found = true
          redirectInfo.type = "js-redirect"
          redirectInfo.targetUrl = targetUrl
          redirectInfo.message = `JavaScript redirect to ${targetUrl}`

          addDebugLog(`✅ Found JavaScript redirect to ${targetUrl}`)

          // Cache the result
          cache.set(cacheKey, redirectInfo, 3600)
          return redirectInfo
        }
      }

      // 5. Check setTimeout redirects
      for (const pattern of setTimeoutPatterns) {
        const match = html.match(pattern)
        if (match) {
          let targetUrl = match[1]
          const delay = Number.parseInt(match[2], 10) / 1000 // Convert ms to seconds

          targetUrl = normalizeUrl(targetUrl, originalUrl)

          redirectInfo.found = true
          redirectInfo.type = "js-timeout-redirect"
          redirectInfo.targetUrl = targetUrl
          redirectInfo.delay = delay
          redirectInfo.message = `JavaScript timed redirect to ${targetUrl} after ${delay} seconds`

          addDebugLog(`✅ Found JavaScript timed redirect: ${delay}s delay to ${targetUrl}`)

          // Cache the result
          cache.set(cacheKey, redirectInfo, 3600)
          return redirectInfo
        }
      }

      // Cache negative result too (with shorter TTL)
      cache.set(cacheKey, redirectInfo, 1800) // 30 minutes TTL for negative results
      return redirectInfo
    } catch (error) {
      addDebugLog(`Error detecting client-side redirects: ${error instanceof Error ? error.message : String(error)}`)
      return { found: false }
    }
  }

  // Function to get snapshots with pagination support
  async function getSnapshotsWithPagination(baseUrl, filter = "", maxSnapshots = MAX_SNAPSHOTS_PER_REQUEST) {
    // Create cache key based on URL and filter
    const cacheKey = `snapshots:${baseUrl}:${filter}:${maxSnapshots}`

    // Check cache
    if (cache.has(cacheKey)) {
      addDebugLog(`Cache hit for snapshots: ${baseUrl}`)
      return cache.get(cacheKey)
    }

    let allSnapshots = []
    let hasMore = true
    let from = 0
    const limit = 1000 // Number of snapshots per request

    addDebugLog(`Getting snapshots with pagination from ${baseUrl}`)

    while (hasMore && allSnapshots.length < maxSnapshots) {
      try {
        // Check if we should pause due to network issues
        if (!networkMonitor.isHealthy()) {
          addDebugLog(`Pausing snapshot retrieval for 30 seconds due to network issues...`)
          await sleep(30000) // 30 second pause
          networkMonitor.reset() // Reset after pause
        }

        // Add pagination parameters
        const url = `${baseUrl}&limit=${limit}&offset=${from}${filter ? `&filter=${filter}` : ""}`
        const pageCacheKey = `page:${url}`

        addDebugLog(`Fetching page: offset=${from}, limit=${limit}`)

        let snapshots

        // Check page cache first
        if (cache.has(pageCacheKey)) {
          snapshots = cache.get(pageCacheKey)
          addDebugLog(`Cache hit for page: offset=${from}`)
        } else {
          const response = await requestWithRetry(url)
          const data = await response.json()

          if (data && data.length > 1) {
            // First row is header, rest are snapshots
            snapshots = data.slice(1)
            // Cache page results
            cache.set(pageCacheKey, snapshots, 3600)
          } else {
            snapshots = []
          }
        }

        if (snapshots.length > 0) {
          addDebugLog(`Found ${snapshots.length} snapshots in this page`)

          // Add to collection
          allSnapshots = [...allSnapshots, ...snapshots]

          // If we got fewer snapshots than the limit, we've reached the end
          if (snapshots.length < limit) {
            hasMore = false
            addDebugLog(`End of snapshots reached (got ${snapshots.length} < ${limit})`)
          } else {
            // Move to next page
            from += limit
            addDebugLog(`Moving to next page: offset=${from}`)

            // Add a small delay between requests to avoid rate limiting
            await sleep(500) // Reduced from 1000 to 500ms for faster execution
          }
        } else {
          // No snapshots or error
          hasMore = false
          addDebugLog(`No more snapshots found or error in response`)
        }
      } catch (error) {
        addDebugLog(`Error in pagination: ${error instanceof Error ? error.message : String(error)}`)
        hasMore = false

        // If we're experiencing network issues, add a longer delay
        if (!networkMonitor.isHealthy()) {
          addDebugLog(`Adding extra delay due to network issues...`)
          await sleep(10000) // 10 second delay
        }
      }

      // Safety check - don't exceed maximum
      if (allSnapshots.length >= maxSnapshots) {
        addDebugLog(`Reached maximum snapshots limit (${maxSnapshots})`)
        break
      }
    }

    addDebugLog(`Total snapshots collected with pagination: ${allSnapshots.length}`)

    // Cache the full result
    cache.set(cacheKey, allSnapshots, 3600)
    return allSnapshots
  }

  // Function to get 3XX snapshots
  async function get3xxSnapshots() {
    try {
      // URL variations for search - FOCUS ON MAIN DOMAIN
      const urlVariations = [
        `${BASE_URL}/cdx/search/cdx?url=${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://www.${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://www.${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        // Add variations with trailing slash
        `${BASE_URL}/cdx/search/cdx?url=${domain}/&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}/&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://${domain}/&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://www.${domain}/&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://www.${domain}/&output=json&fl=timestamp,original,statuscode,digest`,
        // Add index.html variations
        `${BASE_URL}/cdx/search/cdx?url=${domain}/index.html&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}/index.html&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://${domain}/index.html&output=json&fl=timestamp,original,statuscode,digest`,
        // Add index.php variations
        `${BASE_URL}/cdx/search/cdx?url=${domain}/index.php&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}/index.php&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://${domain}/index.php&output=json&fl=timestamp,original,statuscode,digest`,
        // Add port 80 variations
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}:80&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}:80/&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://www.${domain}:80&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://www.${domain}:80/&output=json&fl=timestamp,original,statuscode,digest`,
      ]

      // Create cache key for this domain's 3XX snapshots
      const cacheKey = `3xx-snapshots:${domain}`

      // Check cache
      if (cache.has(cacheKey)) {
        addDebugLog(`Cache hit for 3XX snapshots for ${domain}`)
        return cache.get(cacheKey)
      }

      addDebugLog(`Getting 3XX snapshots for ${domain}...`)

      // Process URL variations in parallel with a limit on concurrent requests
      const snapshotsArrays = await processInParallel(
        urlVariations,
        async (url) => {
          try {
            // Get snapshots with pagination and filter for 3XX status codes
            return await getSnapshotsWithPagination(url, "statuscode:3", MAX_SNAPSHOTS_TO_CHECK)
          } catch (error) {
            addDebugLog(
              `Failed to get snapshots from ${url}: ${error instanceof Error ? error.message : String(error)}`,
            )
            return []
          }
        },
        5, // Increased from 3 to 5 concurrent requests for faster execution
      )

      // Combine all snapshot arrays
      let allSnapshots = []
      for (const snapshots of snapshotsArrays) {
        if (snapshots && snapshots.length > 0) {
          allSnapshots = [...allSnapshots, ...snapshots]
        }
      }

      // Remove duplicates based on timestamp and URL
      const uniqueSnapshots = []
      const seen = new Set()

      for (const snapshot of allSnapshots) {
        const key = `${snapshot[0]}_${snapshot[1]}` // timestamp_originalUrl
        if (!seen.has(key)) {
          seen.add(key)
          uniqueSnapshots.push(snapshot)
        }
      }

      addDebugLog(`Total ${uniqueSnapshots.length} unique 3XX snapshots found`)

      // Cache the result
      cache.set(cacheKey, uniqueSnapshots, 3600)
      return uniqueSnapshots
    } catch (error) {
      addDebugLog(`Error getting snapshots: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
  }

  // Function to get 200 OK snapshots for client-side redirect checking
  async function get200Snapshots() {
    try {
      // URL variations for search - FOCUS ON MAIN DOMAIN
      const urlVariations = [
        `${BASE_URL}/cdx/search/cdx?url=${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://www.${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=https://www.${domain}&output=json&fl=timestamp,original,statuscode,digest`,
        // Add variations with trailing slash
        `${BASE_URL}/cdx/search/cdx?url=${domain}/&output=json&fl=timestamp,original,statuscode,digest`,
        `${BASE_URL}/cdx/search/cdx?url=http://${domain}/&output=json&fl=timestamp,original,statuscode,digest`,
      ]

      // Create cache key for this domain's 200 OK snapshots
      const cacheKey = `200-snapshots:${domain}`

      // Check cache
      if (cache.has(cacheKey)) {
        addDebugLog(`Cache hit for 200 OK snapshots for ${domain}`)
        return cache.get(cacheKey)
      }

      addDebugLog(`Getting 200 OK snapshots for ${domain} to check for client-side redirects...`)

      // Process URL variations in parallel with a limit on concurrent requests
      const snapshotsArrays = await processInParallel(
        urlVariations,
        async (url) => {
          try {
            // Get snapshots with pagination and filter for 200 status codes
            return await getSnapshotsWithPagination(url, "statuscode:200", MAX_SNAPSHOTS_TO_CHECK)
          } catch (error) {
            addDebugLog(
              `Failed to get snapshots from ${url}: ${error instanceof Error ? error.message : String(error)}`,
            )
            return []
          }
        },
        5, // Increased from 3 to 5 concurrent requests for faster execution
      )

      // Combine all snapshot arrays
      let allSnapshots = []
      for (const snapshots of snapshotsArrays) {
        if (snapshots && snapshots.length > 0) {
          allSnapshots = [...allSnapshots, ...snapshots]
        }
      }

      // Remove duplicates based on timestamp and URL
      const uniqueSnapshots = []
      const seen = new Set()

      for (const snapshot of allSnapshots) {
        const key = `${snapshot[0]}_${snapshot[1]}` // timestamp_originalUrl
        if (!seen.has(key)) {
          seen.add(key)
          uniqueSnapshots.push(snapshot)
        }
      }

      addDebugLog(`Total ${uniqueSnapshots.length} unique 200 OK snapshots found`)

      // Cache the result
      cache.set(cacheKey, uniqueSnapshots, 3600)
      return uniqueSnapshots
    } catch (error) {
      addDebugLog(`Error getting 200 OK snapshots: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
  }

  // Function to get redirect target from header
  async function getRedirectTargetFromHeader(timestamp, originalUrl) {
    try {
      // Create cache key for redirect target
      const cacheKey = `redirect-target:${timestamp}:${originalUrl}`

      // Check cache
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey)
      }

      // Format Wayback Machine URL
      const waybackUrl = `${BASE_URL}/web/${timestamp}/${originalUrl}`

      addDebugLog(`Checking redirect header from: ${waybackUrl}`)

      // Use manual redirect mode to get Location header
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

      try {
        const response = await fetch(waybackUrl, {
          redirect: "manual",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId))

        // Accept 3XX status codes
        const statusCode = response.status.toString()
        if (!statusCode.startsWith("3")) {
          addDebugLog(`⚠️ Not a 3XX redirect: Status code ${statusCode}`)

          // Check for client-side redirects in the content
          if (statusCode.startsWith("2")) {
            const html = await response.text()
            const clientSideRedirect = await detectClientSideRedirects(html, originalUrl)

            if (clientSideRedirect.found) {
              addDebugLog(`✅ Found client-side redirect: ${clientSideRedirect.message}`)
              const result = {
                targetUrl: clientSideRedirect.targetUrl,
                statusCode: statusCode,
                clientSide: true,
                redirectInfo: clientSideRedirect,
              }

              // Cache the result
              cache.set(cacheKey, result, 3600)
              return result
            }
          }

          // Cache null result
          cache.set(cacheKey, null, 1800) // 30 mins TTL for negative results
          return null
        }

        // Debug - show all headers
        addDebugLog(`Response headers for ${waybackUrl}:`)
        for (const [key, value] of response.headers.entries()) {
          addDebugLog(`${key}: ${value}`)
        }

        const location = response.headers.get("location")
        if (location) {
          addDebugLog(`Found Location header: ${location}`)

          // If URL is a Wayback Machine URL, extract original URL
          let targetUrl = location

          if (targetUrl.includes("web.archive.org/web/")) {
            const urlMatch = targetUrl.match(/web\.archive\.org\/web\/\d+(?:id_)?\/(?:https?:\/\/)?(.+)/i)
            if (urlMatch && urlMatch[1]) {
              // Preserve port if present
              const hasPort = urlMatch[1].includes(":")
              targetUrl = "http://" + urlMatch[1]
              addDebugLog(
                `Extracted original URL from Wayback Machine URL: ${targetUrl}${hasPort ? " (with port)" : ""}`,
              )
            }
          } else if (targetUrl.startsWith("/web/")) {
            // If URL is a relative Wayback Machine URL, extract original URL
            const urlMatch = targetUrl.match(/\/web\/\d+(?:id_)?\/(?:https?:\/\/)?(.+)/i)
            if (urlMatch && urlMatch[1]) {
              // Preserve port if present
              const hasPort = urlMatch[1].includes(":")
              targetUrl = "http://" + urlMatch[1]
              addDebugLog(
                `Extracted original URL from relative Wayback Machine URL: ${targetUrl}${hasPort ? " (with port)" : ""}`,
              )
            }
          } else if (targetUrl.startsWith("/")) {
            // If relative URL, combine with original domain
            const originalDomain = extractDomain(originalUrl)
            targetUrl = `http://${originalDomain}${targetUrl}`
            addDebugLog(`Relative URL combined with original domain: ${targetUrl}`)
          }

          // If URL has no protocol, add http://
          if (!targetUrl.startsWith("http")) {
            targetUrl = "http://" + targetUrl
          }

          const result = { targetUrl, statusCode, clientSide: false }
          // Cache the result
          cache.set(cacheKey, result, 3600)
          return result
        } else {
          // If no Location header but status code is 3XX,
          // we need to check the page content to try to find the redirect
          try {
            const text = await response.text()

            // Check for client-side redirects in the content
            const clientSideRedirect = await detectClientSideRedirects(text, originalUrl)

            if (clientSideRedirect.found) {
              addDebugLog(`✅ Found client-side redirect in 3XX response: ${clientSideRedirect.message}`)
              const result = {
                targetUrl: clientSideRedirect.targetUrl,
                statusCode: statusCode,
                clientSide: true,
                redirectInfo: clientSideRedirect,
              }

              // Cache the result
              cache.set(cacheKey, result, 3600)
              return result
            }

            // Check for meta refresh
            const metaRefreshMatch = text.match(
              /<meta\s+http-equiv=["']?refresh["']?\s+content=["']?\d+;\s*url=([^"'>]+)["']?\s*\/?>/i,
            )
            if (metaRefreshMatch && metaRefreshMatch[1]) {
              let metaUrl = metaRefreshMatch[1]

              // If URL is relative, combine with original domain
              if (metaUrl.startsWith("/")) {
                const originalDomain = extractDomain(originalUrl)
                metaUrl = `http://${originalDomain}${metaUrl}`
              } else if (!metaUrl.startsWith("http")) {
                metaUrl = `http://${metaUrl}`
              }

              addDebugLog(`Found meta refresh redirect to: ${metaUrl}`)
              const result = { targetUrl: metaUrl, statusCode, clientSide: true }
              // Cache the result
              cache.set(cacheKey, result, 3600)
              return result
            }

            // Check for JavaScript redirect
            const jsRedirectMatch = text.match(/(?:window\.location|location\.href)\s*=\s*["']([^"']+)["']/i)
            if (jsRedirectMatch && jsRedirectMatch[1]) {
              let jsUrl = jsRedirectMatch[1]

              // If URL is relative, combine with original domain
              if (jsUrl.startsWith("/")) {
                const originalDomain = extractDomain(originalUrl)
                jsUrl = `http://${originalDomain}${jsUrl}`
              } else if (!jsUrl.startsWith("http")) {
                jsUrl = `http://${jsUrl}`
              }

              addDebugLog(`Found JavaScript redirect to: ${jsUrl}`)
              const result = { targetUrl: jsUrl, statusCode, clientSide: true }
              // Cache the result
              cache.set(cacheKey, result, 3600)
              return result
            }
          } catch (e) {
            addDebugLog(`Error analyzing page content: ${e.message}`)
          }
        }

        // Special case for URLs with explicit port
        if (originalUrl.includes(":")) {
          const portMatch = originalUrl.match(/:(\d+)/)
          if (portMatch) {
            const port = portMatch[1]
            const originalDomain = extractDomain(originalUrl)

            // Strategy for port 80 (standard HTTP)
            if (port === "80") {
              // Try standard redirect - to www or non-www
              if (originalDomain.startsWith("www.")) {
                // If already www, try redirect to non-www
                const nonWwwDomain = originalDomain.replace("www.", "")
                const potentialTarget = `http://${nonWwwDomain}`
                addDebugLog(`Assuming standard redirect from www to non-www for port 80: ${potentialTarget}`)
                const result = { targetUrl: potentialTarget, statusCode, clientSide: false }
                // Cache the result
                cache.set(cacheKey, result, 3600)
                return result
              } else {
                // If no www, try redirect to www
                const wwwDomain = `www.${originalDomain}`
                const potentialTarget = `http://${wwwDomain}`
                addDebugLog(`Assuming standard redirect from non-www to www for port 80: ${potentialTarget}`)
                const result = { targetUrl: potentialTarget, statusCode, clientSide: false }
                // Cache the result
                cache.set(cacheKey, result, 3600)
                return result
              }
            }

            // Strategy for port 443 (standard HTTPS)
            if (port === "443") {
              // Try redirect to HTTPS
              const potentialTarget = `https://${originalDomain}`
              addDebugLog(`Assuming standard redirect from explicit port 443 to HTTPS: ${potentialTarget}`)
              const result = { targetUrl: potentialTarget, statusCode, clientSide: false }
              // Cache the result
              cache.set(cacheKey, result, 3600)
              return result
            }

            // General strategy for other ports - try without port
            const potentialTarget = `http://${originalDomain}`
            addDebugLog(`Assuming standard redirect from explicit port to standard HTTP: ${potentialTarget}`)
            const result = { targetUrl: potentialTarget, statusCode, clientSide: false }
            // Cache the result
            cache.set(cacheKey, result, 3600)
            return result
          }
        }

        // Cache null result if we couldn't determine redirect target
        cache.set(cacheKey, null, 1800) // 30 mins TTL for negative results
        return null
      } catch (error) {
        if (error.name === "AbortError") {
          addDebugLog(`Timeout checking redirect header: Request timed out after ${TIMEOUT / 1000} seconds`)
        } else {
          addDebugLog(`Error checking header: ${error instanceof Error ? error.message : String(error)}`)
        }

        // Record error for network monitoring
        networkMonitor.recordError()

        // Cache null result on error
        cache.set(cacheKey, null, 1800)
        return null
      }
    } catch (error) {
      addDebugLog(`Error checking header: ${error instanceof Error ? error.message : String(error)}`)

      // Record error for network monitoring
      networkMonitor.recordError()

      // Cache null result on error
      const cacheKey = `redirect-target:${timestamp}:${originalUrl}`
      cache.set(cacheKey, null, 1800)
      return null
    }
  }

  // Function to check for client-side redirects in 200 OK responses
  async function checkClientSideRedirects(snapshots) {
    try {
      // Create cache key for client-side redirects
      const cacheKey = `client-side-redirects:${domain}:${snapshots.length}`

      // Check cache
      if (cache.has(cacheKey)) {
        addDebugLog(`Cache hit for client-side redirects for ${domain}`)
        return cache.get(cacheKey)
      }

      addDebugLog(`Checking for client-side redirects in ${snapshots.length} snapshots...`)

      // Sort snapshots by timestamp (newest first)
      snapshots.sort((a, b) => b[0].localeCompare(a[0]))

      // Limit the number of snapshots to check for better performance
      const snapshotsToCheck = snapshots.slice(0, 50) // Only check the 50 most recent snapshots

      const clientSideRedirects = []

      // Process snapshots in parallel with limited concurrency
      const results = await processInParallel(
        snapshotsToCheck,
        async (snapshot) => {
          const [timestamp, originalUrl] = snapshot
          const waybackUrl = `${BASE_URL}/web/${timestamp}/${originalUrl}`

          try {
            addDebugLog(`Checking for client-side redirects in: ${waybackUrl}`)

            // Check individual snapshot cache
            const snapshotCacheKey = `client-redirect-check:${timestamp}:${originalUrl}`
            if (cache.has(snapshotCacheKey)) {
              return cache.get(snapshotCacheKey)
            }

            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 seconds timeout (reduced from 60s)

            const response = await fetch(waybackUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
              signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId))

            if (response.ok) {
              const html = await response.text()
              const clientSideRedirect = await detectClientSideRedirects(html, originalUrl)

              if (clientSideRedirect.found) {
                addDebugLog(`✅ Found client-side redirect in 200 OK response: ${clientSideRedirect.message}`)
                const result = {
                  timestamp,
                  originalUrl,
                  redirectInfo: clientSideRedirect,
                  formattedDate: formatWaybackTimestamp(timestamp),
                }

                // Cache individual snapshot result
                cache.set(snapshotCacheKey, result, 3600)
                return result
              }
            }

            // Cache negative result with shorter TTL
            cache.set(snapshotCacheKey, null, 1800)
            return null
          } catch (error) {
            if (error.name === "AbortError") {
              addDebugLog(`Timeout checking for client-side redirects: ${waybackUrl}`)
            } else {
              addDebugLog(
                `Error checking for client-side redirects: ${error instanceof Error ? error.message : String(error)}`,
              )
            }

            // Record error for network monitoring
            networkMonitor.recordError()

            return null
          }
        },
        5, // Increased from 3 to 5 concurrent requests for faster execution
      )

      // Filter out null results and add to clientSideRedirects
      for (const result of results) {
        if (result) {
          clientSideRedirects.push(result)
        }
      }

      addDebugLog(`Found ${clientSideRedirects.length} client-side redirects in 200 OK responses`)

      // Cache the results
      cache.set(cacheKey, clientSideRedirects, 3600)
      return clientSideRedirects
    } catch (error) {
      addDebugLog(`Error checking for client-side redirects: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
  }

  // Function to split long message into chunks for Telegram
  function splitIntoChunks(text, maxChunkSize = MAX_CHUNK_SIZE) {
    const chunks = []
    let currentChunk = ""

    // Split text by newlines to avoid breaking in the middle of a line
    const lines = text.split("\n")

    for (const line of lines) {
      // If adding this line would exceed the chunk size, start a new chunk
      if (currentChunk.length + line.length + 1 > maxChunkSize) {
        chunks.push(currentChunk)
        currentChunk = line
      } else {
        // Add line to current chunk
        if (currentChunk) {
          currentChunk += "\n" + line
        } else {
          currentChunk = line
        }
      }
    }

    // Add the last chunk if it's not empty
    if (currentChunk) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  // Main function to check domain history
  async function checkDomainHistoryFunc() {
    addDebugLog(`Starting domain history check for: ${domain}`)

    try {
      // Create cache keys for main result sections
      const redirectsCacheKey = `final-redirects:${domain}`
      const clientSideRedirectsCacheKey = `final-client-redirects:${domain}`

      // Check if we have cached final results
      let resultText = ""
      let hasAllCachedResults = false

      if (cache.has(redirectsCacheKey) && cache.has(clientSideRedirectsCacheKey)) {
        addDebugLog(`Found complete cached results for ${domain}`)
        resultText = cache.get(redirectsCacheKey) + "\n" + cache.get(clientSideRedirectsCacheKey)
        hasAllCachedResults = true
      }

      if (!hasAllCachedResults) {
        // Get 3XX snapshots
        const snapshots3xx = await get3xxSnapshots()

        // Get 200 OK snapshots for client-side redirect checking
        const snapshots200 = await get200Snapshots()

        // Check for client-side redirects in 200 OK responses
        const clientSideRedirects = await checkClientSideRedirects(snapshots200)

        // Format and display results
        let redirectsText = ""
        let clientSideRedirectsText = ""

        // 1. Display 3XX section
        redirectsText = "3XX HTTP REDIRECTS\n=========\n"

        if (snapshots3xx.length === 0) {
          redirectsText += "No 3XX HTTP redirects found\n"
        } else {
          // Sort by timestamp (newest first)
          snapshots3xx.sort((a, b) => b[0].localeCompare(a[0]))

          // Process redirects in parallel
          const redirectResults = await processInParallel(
            snapshots3xx,
            async (snapshot) => {
              const [timestamp, originalUrl, statusCode] = snapshot
              const formattedDate = formatWaybackTimestamp(timestamp)

              // Individual redirect cache key
              const redirectCacheKey = `formatted-redirect:${timestamp}:${originalUrl}`
              if (cache.has(redirectCacheKey)) {
                return cache.get(redirectCacheKey)
              }

              // Get redirect target if available
              const redirectInfo = await getRedirectTargetFromHeader(timestamp, originalUrl)

              let result = ""
              if (redirectInfo) {
                result = `${formattedDate}\n${statusCode} - ${originalUrl} -> ${redirectInfo.targetUrl}\n`
              } else {
                result = `${formattedDate}\n${statusCode} - ${originalUrl}\n`
              }

              // Cache individual formatted redirect
              cache.set(redirectCacheKey, result, 3600)
              return result
            },
            5, // Increased from 3 to 5 concurrent requests for faster execution
          )

          // Combine all redirect results
          redirectsText += redirectResults.join("\n")
        }

        // Cache the redirects section
        cache.set(redirectsCacheKey, redirectsText, 3600)

        // Display CLIENT-SIDE REDIRECTS section
        clientSideRedirectsText = "CLIENT-SIDE REDIRECTS\n=========\n"

        if (clientSideRedirects.length === 0) {
          clientSideRedirectsText += "No client-side redirects found\n"
        } else {
          // Display all client-side redirects
          for (const redirect of clientSideRedirects) {
            clientSideRedirectsText += `${redirect.formattedDate}\n`
            clientSideRedirectsText += `${redirect.originalUrl} -> ${redirect.redirectInfo.targetUrl}\n`

            if (redirect.redirectInfo.delay) {
              clientSideRedirectsText += `Type: ${redirect.redirectInfo.type} (${redirect.redirectInfo.delay} second delay)\n`
            } else {
              clientSideRedirectsText += `Type: ${redirect.redirectInfo.type}\n`
            }

            clientSideRedirectsText += "\n"
          }
        }

        // Cache the client-side redirects section
        cache.set(clientSideRedirectsCacheKey, clientSideRedirectsText, 3600)

        // Combine all sections
        resultText = redirectsText + "\n" + clientSideRedirectsText
      }

      // Split the result into chunks for Telegram
      const chunks = splitIntoChunks(resultText)

      // Add each chunk to logs and messageChunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]

        // Add part number if there are multiple chunks
        if (chunks.length > 1) {
          const chunkHeader = `--- Part ${i + 1}/${chunks.length} ---\n`
          addResultLog(chunkHeader + chunk)
          messageChunks.push(chunkHeader + chunk)
        } else {
          addResultLog(chunk)
          messageChunks.push(chunk)
        }
      }

      // Stop the timer and log the total execution time
      const elapsedTimeMs = timer.stop()
      const elapsedTimeFormatted = timer.getElapsedTimeFormatted()
      const elapsedTimeHMS = timer.getElapsedTimeFormattedHMS()

      addDebugLog(`Total execution time: ${elapsedTimeFormatted} seconds (${elapsedTimeHMS})`)

      // Add cache statistics to debug log
      addDebugLog(`Cache statistics: ${JSON.stringify(cache.stats())}`)

      // Add network health status
      if (networkMonitor.consecutiveErrors > 0) {
        addDebugLog(`Network health: ${networkMonitor.consecutiveErrors} consecutive errors recorded`)
      } else {
        addDebugLog(`Network health: Good`)
      }
    } catch (error) {
      // Catch and log all errors
      const errorMessage = error instanceof Error ? error.message : String(error)
      addDebugLog(`Error checking domain history: ${errorMessage}`)

      // Stop the timer on error
      timer.stop()

      // Reset logs and add error message
      logs.length = 0
      messageChunks.length = 0
      addResultLog(`Error: ${errorMessage}`)
      messageChunks.push(`Error: ${errorMessage}`)
    }
  }

  try {
    // Run the check
    await checkDomainHistoryFunc()

    // Return both logs and message chunks along with timing information
    return {
      logs,
      messageChunks,
      executionTime: {
        seconds: timer.getElapsedTimeFormatted(),
        formatted: timer.getElapsedTimeFormattedHMS(),
        ms: timer.getElapsedTime(),
      },
    }
  } catch (error) {
    // Catch top-level error
    const errorMessage = error instanceof Error ? error.message : String(error)
    addDebugLog(`Error in checkDomainHistory: ${errorMessage}`)

    // Stop the timer on error
    timer.stop()

    // Reset logs and add error message
    logs.length = 0
    messageChunks.length = 0
    addResultLog(`Error: ${errorMessage}`)
    messageChunks.push(`Error: ${errorMessage}`)

    return {
      logs,
      messageChunks,
      executionTime: {
        seconds: timer.getElapsedTimeFormatted(),
        formatted: timer.getElapsedTimeFormattedHMS(),
        ms: timer.getElapsedTime(),
      },
    }
  }
}

// Example usage
checkDomainHistory(domain).then(result => {
  console.log("RESULTS:")
  console.log(result.logs.join("\n"))
  console.log(`Execution time: ${result.executionTime.formatted}`)
})

// Export functions for use in other files
module.exports = {
  checkDomainHistory,
  networkMonitor,
  timer,
}