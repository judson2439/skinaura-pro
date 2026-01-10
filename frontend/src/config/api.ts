/**
 * API Configuration
 */

// Environment-based API URL configuration
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl) {
    return envUrl;
  }

  // Default to localhost in development
  if (import.meta.env.DEV) {
    return 'http://localhost:5505';
  }

  // Production uses same origin
  return window.location.origin;
};

export const API_CONFIG = {
  baseUrl: getApiBaseUrl(),
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
} as const;

export default API_CONFIG;
