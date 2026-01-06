/**
 * Environment configuration with TLS settings
 */

// Compute NODE_ENV first
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDev = NODE_ENV !== 'production';
const isProd = NODE_ENV === 'production';

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '3000', 10),
  HTTPS_PORT: parseInt(process.env.HTTPS_PORT || '3443', 10),
  NODE_ENV,
  isDev,
  isProd,

  // TLS/SSL Configuration - disabled by default in development
  SSL_ENABLED: isProd ? true : process.env.SSL_ENABLED === 'true',
  SSL_KEY_PATH: process.env.SSL_KEY_PATH || '',
  SSL_CERT_PATH: process.env.SSL_CERT_PATH || '',
  SSL_CA_PATH: process.env.SSL_CA_PATH || '',
  
  // Mutual TLS (mTLS) - client certificate verification
  MTLS_ENABLED: process.env.MTLS_ENABLED === 'true',

  // HTTPS redirect settings
  FORCE_HTTPS: process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production',
  TRUST_PROXY: process.env.TRUST_PROXY === 'true',

  // API Configuration
  API_BASE_URL: process.env.API_BASE_URL || '',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:8080',

  // Encryption key for request/response encryption (must match frontend)
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'skinaura-default-key-32chars!!',

  // PostgreSQL Database Configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'skinaura',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: process.env.DB_SSL === 'true',

  // JWT Configuration for session tokens
  JWT_SECRET: process.env.JWT_SECRET || 'skinaura-jwt-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Mailgun Configuration for email sending
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY || '',
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || '',
  MAILGUN_FROM_EMAIL: process.env.MAILGUN_FROM_EMAIL || 'noreply@skinaura.pro',
  MAILGUN_FROM_NAME: process.env.MAILGUN_FROM_NAME || 'SkinAura PRO',

  // Frontend URL for email links
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8080',

  // Verification code expiry (in minutes)
  VERIFICATION_CODE_EXPIRY_MINUTES: parseInt(process.env.VERIFICATION_CODE_EXPIRY_MINUTES || '30', 10),

  // Twilio Configuration for SMS sending
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
} as const;

// Validate required environment variables in production
export const validateEnv = (): void => {
  const errors: string[] = [];

  if (env.isProd) {
    if (env.SSL_ENABLED && (!env.SSL_KEY_PATH || !env.SSL_CERT_PATH)) {
      errors.push('SSL_KEY_PATH and SSL_CERT_PATH are required when SSL_ENABLED is true');
    }
    if (!env.DB_PASSWORD) {
      errors.push('DB_PASSWORD is required in production');
    }
    if (env.JWT_SECRET === 'skinaura-jwt-secret-change-in-production') {
      errors.push('JWT_SECRET must be changed from default in production');
    }
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }
};
