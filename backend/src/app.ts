import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { decryptRequestMiddleware } from './middleware/decryptRequest.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import healthRouter from './routes/health.js';
import apiRouter from './routes/index.js';

const app: Application = express();

// Trust proxy if behind load balancer/reverse proxy
if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// Helmet security middleware (basic security headers)
app.use(helmet({
  // API is consumed cross-origin from the frontend host; same-origin CORP
  // can cause browsers to treat successful responses as opaque network failures.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration — allow configured production origin + local Vite ports
const corsOrigins = new Set<string>([
  'http://localhost:8000',
  'http://localhost:8080',
  'http://localhost:5173',
]);
if (env.CORS_ORIGIN) {
  env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean).forEach((o) => corsOrigins.add(o));
}
if (env.FRONTEND_URL) {
  corsOrigins.add(env.FRONTEND_URL);
}

app.use(cors({
  origin: Array.from(corsOrigins),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Encrypted'],
}));

// Request logging
app.use(morgan('dev'));

// Body parsing - allow up to 20MB original files sent as base64 JSON
// 20MB file + base64 (~33%) + JSON/encryption overhead ≈ ~30MB
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Decrypt encrypted request bodies (after body parsing, before routes)
app.use(decryptRequestMiddleware);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/health', healthRouter);

// Apply general rate limiting to all API routes
app.use('/api', apiRateLimiter, apiRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
