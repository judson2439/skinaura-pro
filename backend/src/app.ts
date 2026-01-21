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

// CORS configuration - always include localhost:8080 for development
const corsOrigins: (string | RegExp)[] = ['http://localhost:8000'];
if (env.CORS_ORIGIN && env.CORS_ORIGIN !== 'http://localhost:8000') {
  corsOrigins.push(env.CORS_ORIGIN);
}

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Encrypted'],
}));

// Request logging
app.use(morgan('dev'));

// Body parsing - increased limit to accommodate encrypted file uploads
// 5MB file + base64 encoding (~33% increase) + encryption overhead = ~8-10MB
// Using 20MB to be safe for encrypted payloads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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
