// Configuration for Tembea Sacco Vercel deployment
export const config = {
  site: {
    name: 'Tembea Sacco',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://tembeasacco.vercel.app',
    description: 'Modern Digital SACCO Management System',
    theme: {
      primaryColor: '#22c55e',
      borderRadius: '0.75rem',
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
    },
  },
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://api.tembeasacco.vercel.app',
    timeout: 30000,
    endpoints: {
      auth: '/api/auth',
      members: '/api/members',
      accounts: '/api/accounts',
      loans: '/api/loans',
      transactions: '/api/transactions',
    },
  },
  vercel: {
    environment: process.env.VERCEL_ENV || 'production',
    region: process.env.VERCEL_REGION || 'nrt1',
    url: process.env.VERCEL_URL || 'tembeasacco.vercel.app',
  },
  features: {
    enableAnalytics: true,
    enableNotifications: true,
    enableMobileApp: true,
    enableDarkMode: false,
  },
} as const;

export type AppConfig = typeof config;
