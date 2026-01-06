# SkinAura PRO

A comprehensive skincare management platform for professionals and clients, built with React, TypeScript, Tailwind CSS, and Supabase.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Security Features](#security-features)
- [Database Schema](#database-schema)
- [Edge Functions](#edge-functions)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Overview

SkinAura PRO is a full-featured skincare management application that connects skincare professionals with their clients. It provides tools for tracking skincare routines, managing appointments, analyzing skin progress, and building personalized treatment plans.

### Key Use Cases

- **For Clients**: Track daily skincare routines, log skin conditions, view progress photos, and communicate with skincare professionals.
- **For Professionals**: Manage client portfolios, create treatment plans, track treatment effectiveness, and schedule appointments.

## Features

### Authentication & Security
- JWT-based authentication with httpOnly cookies
- CSRF protection for all authenticated requests
- Input validation and XSS sanitization
- Rate limiting for login attempts
- Password strength validation

### Client Features
- Daily skin check-ins and logging
- Progress photo tracking with comparison tools
- Personalized routine management
- Gamification with challenges and rewards
- Appointment booking

### Professional Features
- Client management dashboard
- Treatment plan creation and tracking
- Treatment effectiveness analytics
- Bulk client import (CSV)
- Product catalog management
- Appointment calendar

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| State Management | React Context API |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Edge Functions | Deno (Supabase Edge Functions) |
| Build Tool | Vite |
| Package Manager | npm |

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)
- **Supabase CLI** (for local development and edge functions)
- **Git**

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Install Supabase CLI
npm install -g supabase
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/skinaura-pro.git
cd skinaura-pro
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

#### Option A: Use Supabase Cloud (Recommended for production)

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from Settings > API
3. Create a `.env` file (see [Environment Variables](#environment-variables))

#### Option B: Use Supabase Local (For development)

```bash
# Start Supabase locally
supabase start

# This will output your local credentials
# API URL: http://localhost:54321
# anon key: eyJ...
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit the `.env` file with your Supabase credentials (see [Environment Variables](#environment-variables)).

### 5. Run Database Migrations

```bash
# Apply migrations to your Supabase project
supabase db push
```

### 6. Deploy Edge Functions

```bash
# Deploy all edge functions
supabase functions deploy secure-auth
```

### 7. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# =============================================================================
# SUPABASE CONFIGURATION (Required)
# =============================================================================

# Your Supabase project URL
# Format: https://<project-ref>.supabase.co
VITE_SUPABASE_URL=https://your-project.supabase.co

# Your Supabase anonymous (public) key
# Found in: Supabase Dashboard > Settings > API > anon public
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# =============================================================================
# OPTIONAL CONFIGURATION
# =============================================================================

# Application environment (development, staging, production)
VITE_APP_ENV=development

# Enable debug logging (true/false)
VITE_DEBUG=false

# API rate limiting (requests per minute)
VITE_RATE_LIMIT=60
```

### Environment Variable Descriptions

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL. Found in Supabase Dashboard > Settings > API |
| `VITE_SUPABASE_ANON_KEY` | Yes | Public anonymous key for client-side requests. Found in Supabase Dashboard > Settings > API |
| `VITE_APP_ENV` | No | Current environment. Affects logging and error handling |
| `VITE_DEBUG` | No | Enable verbose console logging for debugging |
| `VITE_RATE_LIMIT` | No | Maximum API requests per minute per user |

### Edge Function Environment Variables

Edge functions require additional secrets. Set these in Supabase Dashboard > Settings > Edge Functions:

```bash
# Or via CLI
supabase secrets set JWT_SECRET=your-jwt-secret-min-32-chars
supabase secrets set CSRF_SECRET=your-csrf-secret-min-32-chars
```

| Secret | Description |
|--------|-------------|
| `JWT_SECRET` | Secret key for signing JWT tokens (min 32 characters) |
| `CSRF_SECRET` | Secret key for CSRF token generation (min 32 characters) |

## Project Structure

```
skinaura-pro/
├── public/                     # Static assets
│   ├── robots.txt
│   └── sw.js                   # Service worker
├── src/
│   ├── components/             # React components
│   │   ├── appointments/       # Appointment-related components
│   │   ├── auth/               # Authentication components
│   │   │   └── AuthModal.tsx   # Login/signup modal
│   │   ├── challenges/         # Gamification components
│   │   ├── clients/            # Client management (professionals)
│   │   ├── notifications/      # Notification components
│   │   ├── photos/             # Photo comparison tools
│   │   ├── products/           # Product management
│   │   ├── reports/            # Progress reports
│   │   ├── routines/           # Routine management
│   │   ├── settings/           # User settings
│   │   ├── skincare/           # Skincare tracking
│   │   ├── treatments/         # Treatment plans
│   │   └── ui/                 # Reusable UI components (shadcn)
│   │       └── SecureInput.tsx # Secure input with validation
│   ├── contexts/               # React contexts
│   │   ├── AppContext.tsx      # Application state
│   │   └── AuthContext.tsx     # Authentication state
│   ├── hooks/                  # Custom React hooks
│   │   ├── useSecureAuth.ts    # Secure authentication hook
│   │   └── ...                 # Other domain-specific hooks
│   ├── lib/                    # Utility libraries
│   │   ├── security.ts         # Security utilities
│   │   ├── supabase.ts         # Supabase client
│   │   └── utils.ts            # General utilities
│   ├── pages/                  # Page components
│   │   ├── Index.tsx           # Home page
│   │   ├── NotFound.tsx        # 404 page
│   │   └── ResetPassword.tsx   # Password reset page
│   ├── App.tsx                 # Root component with routing
│   ├── main.tsx                # Application entry point
│   └── index.css               # Global styles
├── supabase/
│   ├── functions/              # Edge functions
│   │   └── secure-auth/        # Authentication edge function
│   └── migrations/             # Database migrations
├── .env.example                # Environment template
├── package.json
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration
```

## Security Features

### Authentication Security

The application implements multiple layers of authentication security:

#### 1. JWT Tokens with httpOnly Cookies

```typescript
// Tokens are stored in httpOnly cookies, not accessible via JavaScript
// This prevents XSS attacks from stealing tokens
```

#### 2. CSRF Protection

```typescript
import { getCSRFToken, createSecureHeaders } from '@/lib/security';

// All authenticated requests include CSRF token
const headers = createSecureHeaders();
// Headers include: X-CSRF-Token: <token>
```

#### 3. Input Validation

```typescript
import { validateInput, validateForm } from '@/lib/security';

// Validate single input
const result = validateInput(email, 'email');
if (!result.valid) {
  console.error(result.error);
}

// Validate entire form
const formResult = validateForm(data, {
  email: 'email',
  password: { required: true, minLength: 8 }
});
```

#### 4. XSS Sanitization

```typescript
import { sanitizeInput, sanitizeObject } from '@/lib/security';

// Sanitize user input
const safeInput = sanitizeInput(userInput);

// Sanitize entire object
const safeData = sanitizeObject(formData);
```

#### 5. Rate Limiting

```typescript
import { RateLimiter } from '@/lib/security';

const limiter = new RateLimiter(5, 60000); // 5 attempts per minute

if (!limiter.canAttempt()) {
  const waitTime = limiter.getTimeUntilReset();
  showError(`Please wait ${waitTime}ms`);
}
```

#### 6. Password Strength Checking

```typescript
import { checkPasswordStrength } from '@/lib/security';

const strength = checkPasswordStrength(password);
// strength.score: 0-4
// strength.label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong'
// strength.suggestions: ['Add uppercase letters', ...]
```

## Database Schema

### Core Tables

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT CHECK (role IN ('client', 'professional')),
  avatar_url TEXT,
  skin_type TEXT,
  concerns TEXT[],
  business_name TEXT,
  license_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress photos
CREATE TABLE progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  photo_url TEXT NOT NULL,
  notes TEXT,
  skin_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Treatment plans
CREATE TABLE treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES user_profiles(id),
  client_id UUID REFERENCES user_profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

All tables have RLS policies to ensure users can only access their own data:

```sql
-- Example: Users can only read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Professionals can read their clients' profiles
CREATE POLICY "Professionals can read client profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM treatment_plans
      WHERE professional_id = auth.uid()
      AND client_id = user_profiles.id
    )
  );
```

## Edge Functions

### secure-auth

Handles secure authentication with JWT tokens and CSRF protection.

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/secure-auth/signup` | POST | Register new user |
| `/secure-auth/login` | POST | Authenticate user |
| `/secure-auth/logout` | POST | Sign out and clear cookies |
| `/secure-auth/verify` | POST | Verify session validity |
| `/secure-auth/refresh` | POST | Refresh JWT tokens |
| `/secure-auth/csrf` | POST | Get new CSRF token |

**Deploy:**

```bash
supabase functions deploy secure-auth
```

## Deployment

### Option 1: Vercel (Recommended)

1. **Connect Repository**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel
   ```

2. **Configure Environment Variables**
   - Go to Vercel Dashboard > Project > Settings > Environment Variables
   - Add all variables from `.env`

3. **Configure Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### Option 2: Netlify

1. **Connect Repository**
   - Go to Netlify Dashboard > New site from Git
   - Select your repository

2. **Configure Build Settings**
   ```
   Build command: npm run build
   Publish directory: dist
   ```

3. **Add Environment Variables**
   - Go to Site settings > Environment variables
   - Add all variables from `.env`

### Option 3: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and run
docker build -t skinaura-pro .
docker run -p 80:80 skinaura-pro
```

### Supabase Edge Functions Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy secure-auth

# Set secrets
supabase secrets set JWT_SECRET=your-secret
supabase secrets set CSRF_SECRET=your-secret
```

### Production Checklist

- [ ] Set all environment variables in production
- [ ] Enable RLS on all Supabase tables
- [ ] Deploy edge functions with secrets
- [ ] Configure custom domain
- [ ] Enable SSL/TLS
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Review security headers
- [ ] Test authentication flow
- [ ] Verify CSRF protection

## Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Type check
npm run typecheck
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Add JSDoc comments to all functions
- Write meaningful commit messages
- Include tests for new features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

For support, please open an issue on GitHub or contact the development team.

## Acknowledgments

- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Supabase](https://supabase.com/)
- [Vite](https://vitejs.dev/)
