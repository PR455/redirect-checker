/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['ik.imagekit.io'], // Tambahkan domain untuk logo
  },
}

module.exports = nextConfig