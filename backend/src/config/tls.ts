import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import tls from 'tls';
import { env } from './env.js';

/**
 * TLS 1.2+ Configuration for secure connections
 * Enforces modern TLS versions and secure cipher suites
 */

// Minimum TLS version - TLS 1.2
const MIN_TLS_VERSION = 'TLSv1.2';

// Secure cipher suites (TLS 1.2+ compatible)
// Prioritizes ECDHE for forward secrecy and AES-GCM for performance
const SECURE_CIPHERS = [
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-SHA384',
  'ECDHE-RSA-AES256-SHA384',
  'ECDHE-ECDSA-AES128-SHA256',
  'ECDHE-RSA-AES128-SHA256',
].join(':');

// TLS 1.3 cipher suites (Node.js 12+)
const TLS13_CIPHERS = [
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'TLS_AES_128_GCM_SHA256',
].join(':');

export interface TLSConfig {
  key: Buffer | string;
  cert: Buffer | string;
  ca?: Buffer | string;
  minVersion: tls.SecureVersion;
  maxVersion?: tls.SecureVersion;
  ciphers: string;
  honorCipherOrder: boolean;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
}

/**
 * Load SSL certificates from file paths
 */
export const loadCertificates = (): { key: Buffer; cert: Buffer; ca?: Buffer } | null => {
  const keyPath = env.SSL_KEY_PATH;
  const certPath = env.SSL_CERT_PATH;
  const caPath = env.SSL_CA_PATH;

  if (!keyPath || !certPath) {
    console.warn('⚠️  SSL certificate paths not configured. HTTPS disabled.');
    return null;
  }

  try {
    const key = fs.readFileSync(path.resolve(keyPath));
    const cert = fs.readFileSync(path.resolve(certPath));
    const ca = caPath ? fs.readFileSync(path.resolve(caPath)) : undefined;

    console.log('✅ SSL certificates loaded successfully');
    return { key, cert, ca };
  } catch (error) {
    console.error('❌ Failed to load SSL certificates:', error);
    return null;
  }
};

/**
 * Get TLS configuration with secure defaults
 */
export const getTLSConfig = (certs: { key: Buffer; cert: Buffer; ca?: Buffer }): TLSConfig => {
  return {
    key: certs.key,
    cert: certs.cert,
    ca: certs.ca,
    minVersion: MIN_TLS_VERSION as tls.SecureVersion,
    maxVersion: 'TLSv1.3' as tls.SecureVersion,
    ciphers: `${TLS13_CIPHERS}:${SECURE_CIPHERS}`,
    honorCipherOrder: true,
    // For mutual TLS (mTLS), set these to true
    requestCert: env.MTLS_ENABLED,
    rejectUnauthorized: env.MTLS_ENABLED,
  };
};

/**
 * Create HTTPS server with TLS 1.2+ enforcement
 */
export const createSecureServer = (
  app: http.RequestListener
): https.Server | http.Server => {
  const certs = loadCertificates();

  if (!certs) {
    if (env.isProd) {
      throw new Error('SSL certificates required in production mode');
    }
    console.warn('⚠️  Running HTTP server (development mode only)');
    return http.createServer(app);
  }

  const tlsConfig = getTLSConfig(certs);
  const server = https.createServer(tlsConfig, app);

  // Log TLS configuration
  console.log(`🔒 HTTPS server configured with TLS ${MIN_TLS_VERSION}+`);

  return server;
};

/**
 * Get TLS options for outbound HTTPS requests (API clients)
 */
export const getClientTLSOptions = (): https.RequestOptions => {
  return {
    minVersion: MIN_TLS_VERSION as tls.SecureVersion,
    maxVersion: 'TLSv1.3' as tls.SecureVersion,
    ciphers: `${TLS13_CIPHERS}:${SECURE_CIPHERS}`,
    rejectUnauthorized: true, // Always verify server certificates
  };
};

/**
 * Verify TLS version of a connection
 */
export const verifyTLSVersion = (socket: tls.TLSSocket): boolean => {
  const protocol = socket.getProtocol();
  if (!protocol) return false;

  const version = protocol.replace('TLSv', '');
  const minVersion = parseFloat(MIN_TLS_VERSION.replace('TLSv', ''));
  const currentVersion = parseFloat(version);

  return currentVersion >= minVersion;
};

export default {
  loadCertificates,
  getTLSConfig,
  createSecureServer,
  getClientTLSOptions,
  verifyTLSVersion,
  MIN_TLS_VERSION,
};

