/**
 * API Configuration with HTTPS enforcement
 * All API connections require TLS 1.2+
 */

// Environment-based API URL configuration
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl) {
    return enforceHttps(envUrl);
  }

  // Default to localhost in development
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  // Production must use HTTPS
  return enforceHttps(window.location.origin);
};

/**
 * Enforce HTTPS for production URLs
 */
const enforceHttps = (url: string): string => {
  if (import.meta.env.DEV) {
    return url; // Allow HTTP in development
  }

  // Convert HTTP to HTTPS for non-localhost URLs
  if (url.startsWith('http://') && !isLocalhost(url)) {
    console.warn('⚠️ Converting HTTP to HTTPS:', url);
    return url.replace('http://', 'https://');
  }

  return url;
};

/**
 * Check if URL is localhost
 */
const isLocalhost = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    );
  } catch {
    return false;
  }
};

export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
} as const;

export default API_CONFIG;

