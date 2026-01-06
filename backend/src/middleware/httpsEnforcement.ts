import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * Middleware to enforce HTTPS connections
 * Redirects HTTP requests to HTTPS in production
 */
export const httpsEnforcement = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip enforcement if disabled
  if (!env.FORCE_HTTPS) {
    next();
    return;
  }

  // Check if request is already secure
  const isSecure = 
    req.secure || 
    req.headers['x-forwarded-proto'] === 'https' ||
    req.headers['x-forwarded-ssl'] === 'on';

  if (isSecure) {
    next();
    return;
  }

  // Skip redirect for health checks (allow load balancer health checks over HTTP)
  if (req.path === '/health' || req.path === '/health/live') {
    next();
    return;
  }

  // Redirect to HTTPS
  const httpsUrl = `https://${req.hostname}${req.url}`;
  
  console.log(`🔒 Redirecting HTTP to HTTPS: ${req.url}`);
  
  // Use 301 for permanent redirect (better for SEO)
  res.redirect(301, httpsUrl);
};

/**
 * Middleware to add security headers related to HTTPS
 */
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // HTTP Strict Transport Security (HSTS)
  // Tells browsers to only use HTTPS for this domain
  if (env.FORCE_HTTPS || env.isProd) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy for API
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'"
  );

  next();
};

/**
 * Middleware to validate TLS version on incoming connections
 * Note: This works when the server handles TLS directly (not behind a proxy)
 */
export const validateTLSVersion = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const socket = req.socket as any;

  // Check if this is a TLS socket
  if (socket.encrypted && typeof socket.getProtocol === 'function') {
    const protocol = socket.getProtocol();
    
    if (protocol) {
      const version = parseFloat(protocol.replace('TLSv', ''));
      
      if (version < 1.2) {
        console.warn(`⚠️  Rejected connection with TLS ${protocol}`);
        res.status(426).json({
          error: 'Upgrade Required',
          message: 'TLS 1.2 or higher is required',
          minVersion: 'TLSv1.2',
        });
        return;
      }
    }
  }

  next();
};

export default {
  httpsEnforcement,
  securityHeaders,
  validateTLSVersion,
};

