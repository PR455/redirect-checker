/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ["ik.imagekit.io"],
    unoptimized: true,
  },
  // Tambahkan konfigurasi untuk mengatasi masalah CORS
  async headers() {
    return [
      {
        // Terapkan header ini ke semua route
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ]
  },
  // Tambahkan konfigurasi untuk mengatasi masalah dengan API route
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

module.exports = nextConfig

