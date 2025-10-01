# Tembea Sacco - Frontend Monorepo

## 🌟 Overview

A modern, responsive frontend monorepo for Tembea Sacco built with **Next.js 13+, TypeScript, and Tailwind CSS**. Features a beautiful green-themed design with rounded corners, smooth animations, and three distinct portals for different user types.

**Live Demo**: [https://tembeasacco.vercel.app](https://tembeasacco.vercel.app)

## 🎨 Design System

### Theme
- **Primary Color**: Green (#22c55e)
- **Border Radius**: Rounded corners throughout (0.75rem default)
- **Fonts**: Inter (body), Poppins (headings)
- **Shadows**: Soft, medium, large, and floating variants
- **Animations**: Smooth transitions and hover effects

### Key Design Principles
- **Consistent rounded corners** on all interactive elements
- **Floating sidebar** with glass morphism effects
- **Smooth scrolling** that doesn't affect layout
- **Custom scrollbars** that don't push content
- **Card-based layout** with hover animations
- **Responsive design** for all device sizes

## 🏗️ Project Structure

```
frontend/
├── apps/                          # Portal applications
│   ├── member-portal/            # Member-facing application
│   ├── staff-portal/             # Staff administration portal
│   └── board-portal/             # Board oversight portal
├── shared/                       # Shared resources
│   ├── components/              # Reusable React components
│   ├── lib/                     # Utilities and configuration
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── styles/                  # Global styles and Tailwind config
├── public/                      # Static assets
└── package.json                 # Monorepo package configuration
```

## 🚀 Portals

### Member Portal (`/member`)
**Purpose**: Self-service portal for SACCO members
**Features**:
- Account dashboard and balance viewing
- Loan application and status tracking
- Transaction history and statements
- Profile management and KYC updates
- Savings and deposit management

**URL**: `https://tembeasacco.vercel.app/member`

### Staff Portal (`/staff`)
**Purpose**: Administrative portal for SACCO staff
**Features**:
- Member management and approval workflows
- Loan processing and approval system
- Transaction reconciliation
- Reporting and analytics dashboard
- System configuration

**URL**: `https://tembeasacco.vercel.app/staff`

### Board Portal (`/board`)
**Purpose**: Oversight portal for board members
**Features**:
- High-level financial dashboards
- Performance metrics and KPIs
- Strategic reporting
- AGM management
- Compliance oversight

**URL**: `https://tembeasacco.vercel.app/board`

## 🛠️ Technology Stack

### Core Technologies
- **Framework**: Next.js 13+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context + Custom Hooks
- **HTTP Client**: Axios with interceptors
- **Icons**: Lucide React

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint with Next.js config
- **Type Checking**: TypeScript strict mode
- **Version Control**: Git with conventional commits

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm 9+

### Local Development
```bash
# Clone the repository
git clone <repository-url>
cd sacco-system/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Or start specific portals
npm run dev:member    # Member portal on :3001
npm run dev:staff     # Staff portal on :3002
npm run dev:board     # Board portal on :3003
```

### Environment Setup
Create `.env.local`:
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_NAME=Tembea Sacco (Local)
```

## 🎯 Key Features

### Design System Components
```typescript
// Rounded cards with hover effects
<SaccoCard className="p-6">
  <h3>Account Summary</h3>
  <p>Your current balance and activity</p>
</SaccoCard>

// Primary buttons with rounded corners
<Button variant="primary" rounded="lg">
  Apply for Loan
</Button>

// Form inputs with consistent styling
<FormInput 
  label="Email Address"
  type="email"
  placeholder="member@tembeasacco.co.ke"
/>
```

### Responsive Navigation
- **Mobile**: Hamburger menu with slide-in drawer
- **Tablet**: Collapsible sidebar
- **Desktop**: Fixed sidebar with floating design
- **All devices**: Smooth transitions and touch-friendly

### Performance Optimizations
- **Image Optimization**: Next.js Image component with WebP/AVIF
- **Code Splitting**: Automatic with Next.js App Router
- **Font Optimization**: Google Fonts with display swap
- **Bundle Analysis**: Built-in Next.js bundle analyzer

## 🔧 Development Scripts

```bash
# Development
npm run dev              # Start all portals
npm run dev:member       # Start member portal only
npm run dev:staff        # Start staff portal only
npm run dev:board        # Start board portal only

# Building
npm run build           # Build all portals
npm run build:member    # Build member portal
npm run build:staff     # Build staff portal
npm run build:board     # Build board portal

# Code Quality
npm run lint           # Run ESLint
npm run type-check     # Run TypeScript compiler
npm run format         # Format code with Prettier

# Production
npm run start          # Start production server
```

## 🎨 Customization

### Theme Colors
Modify `tailwind.config.js` to update the color scheme:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: '#22c55e', // Change this for different green
        600: '#16a34a',
      }
    }
  }
}
```

### Border Radius
Adjust rounded corners in `tailwind.config.js`:

```javascript
borderRadius: {
  DEFAULT: '0.75rem', // Default rounded
  lg: '1.5rem',       // Large rounded
  xl: '2rem',         // Extra large
}
```

## 📱 Mobile App Integration

The frontend is designed to work seamlessly with the React Native mobile app:
- **Shared Types**: Consistent TypeScript definitions
- **API Integration**: Unified API client patterns
- **Design System**: Similar visual language
- **State Management**: Compatible data flow

## 🔐 Security Features

- **CSP Headers**: Content Security Policy configuration
- **XSS Protection**: Built-in React sanitization
- **HTTPS Enforcement**: Strict transport security
- **API Security**: Token-based authentication
- **Input Validation**: Client and server-side validation

## 📊 Performance Metrics

### Target Performance
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s  
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3s

### Optimization Strategies
- **Image Optimization**: WebP format with responsive sizes
- **Font Loading**: Strategic font-display settings
- **Code Splitting**: Route-based chunking
- **Caching Strategy**: Static generation where possible

## 🚀 Deployment

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### Environment Variables for Production
```env
NEXT_PUBLIC_SITE_URL=https://tembeasacco.vercel.app
NEXT_PUBLIC_API_URL=https://api.tembeasacco.vercel.app
NEXT_PUBLIC_APP_NAME=Tembea Sacco
```

### Build Configuration
- **Output**: Standalone build for better performance
- **Compression**: Gzip and Brotli compression
- **Caching**: Optimal cache headers for static assets
- **CDN**: Vercel's global edge network

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- **TypeScript**: Strict mode with no implicit any
- **Components**: Functional components with hooks
- **Styling**: Tailwind CSS with design system tokens
- **Naming**: PascalCase for components, camelCase for utilities

## 📈 Monitoring & Analytics

### Built-in Monitoring
- **Web Vitals**: Core Web Metrics tracking
- **Error Tracking**: Global error boundaries
- **Performance**: React Profiler integration
- **Analytics**: Custom event tracking

### Custom Dashboards
- **Member Engagement**: Portal usage metrics
- **Performance**: Page load times and interactions
- **Business Metrics**: Conversion and completion rates

## 🐛 Troubleshooting

### Common Issues

**Portal not loading?**
- Check basePath configuration in next.config.js
- Verify environment variables are set
- Ensure proper build process completed

**Styles not applying?**
- Confirm Tailwind CSS is properly configured
- Check for CSS module conflicts
- Verify PostCSS configuration

**API calls failing?**
- Validate API_URL environment variable
- Check CORS configuration on backend
- Verify authentication tokens

### Getting Help
1. Check the [Vercel Deployment Guide](./README_VERCEL.md)
2. Review existing GitHub issues
3. Create a new issue with detailed description

## 📄 License

This project is proprietary software of Tembea Sacco. All rights reserved.

## 👥 Team

**Frontend Lead**: RedwoodsKenyan  
**UI/UX Design**: Tembea Sacco Design Team  
**Quality Assurance**: SACCO Operations Team

---

*Built with ❤️ for Tembea Sacco members and staff*
