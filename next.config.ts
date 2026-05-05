import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow dev-server access from any device on the local network (e.g. mobile camera testing).
  // Pattern matches 192.168.x.y — standard home/office subnet.
  // Run `ipconfig getifaddr en0` to find your machine's IP, then open http://<ip>:3000 on mobile.
  allowedDevOrigins: ['192.168.*.*'],
}

export default nextConfig
