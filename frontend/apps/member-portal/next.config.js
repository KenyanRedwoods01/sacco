/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/member',
  trailingSlash: true,
  env: {
    PORTAL_NAME: 'Member Portal',
    PORTAL_TYPE: 'member',
  },
  publicRuntimeConfig: {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://tembeasacco.vercel.app',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.tembeasacco.vercel.app',
  },
}

module.exports = nextConfig
