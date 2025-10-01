/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  compiler: {
    styledComponents: true,
  },
  images: {
    domains: [
      'localhost', 
      'tembeasacco.vercel.app',
      'api.tembeasacco.vercel.app',
      'tembea-sacco.co.ke',
      'api.tembea-sacco.co.ke',
      'vercel.app'
    ],
    formats: ['image/webp', 'image/avif'],
  },
  env: {
    SITE_URL: 'https://tembeasacco.vercel.app',
    API_URL: 'https://api.tembeasacco.vercel.app',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          }
        ],
      }
    ]
  },
  // Vercel optimization
  poweredByHeader: false,
  compress: true,
  trailingSlash: false,
}

module.exports = nextConfig
