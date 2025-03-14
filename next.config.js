/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ["ik.imagekit.io"],
    unoptimized: true,
  },
  // Konfigurasi webpack yang lebih sederhana
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Konfigurasi untuk client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      }
    }

    // Hapus konfigurasi ignore-loader yang menyebabkan masalah
    return config
  },
}

module.exports = nextConfig

