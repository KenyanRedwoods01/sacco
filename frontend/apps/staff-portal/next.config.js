/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/staff',
  trailingSlash: true,
  env: {
    PORTAL_NAME: 'Staff Portal',
    PORTAL_TYPE: 'staff',
  },
  publicRuntimeConfig: {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://tembeasacco.vercel.app',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.tembeasacco.vercel.app',
  },
}

module.exports = nextConfig
