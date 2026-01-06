/**
 * Secure API Client with TLS enforcement
 * All requests to non-localhost URLs must use HTTPS
 */

import { API_CONFIG } from '../config/api';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  ok: boolean;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  data?: unknown;
}

/**
 * Create an API error with additional context
 */
const createApiError = (
  message: string,
  status?: number,
  code?: string,
  data?: unknown
): ApiError => {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  error.data = data;
  return error;
};

/**
 * Check if a URL uses HTTPS or is localhost
 */
const validateSecureConnection = (url: string): void => {
  const isDev = import.meta.env.DEV;
  
  try {
    const parsed = new URL(url);
    const isLocalhost = 
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1';

    // Allow HTTP only for localhost in development
    if (parsed.protocol === 'http:' && !isLocalhost && !isDev) {
      throw createApiError(
        'HTTPS required for all API connections',
        0,
        'INSECURE_CONNECTION'
      );
    }
  } catch (e) {
    if ((e as ApiError).code === 'INSECURE_CONNECTION') {
      throw e;
    }
    // URL parsing failed - let the request fail naturally
  }
};

/**
 * Secure API Client class
 */
class SecureApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: {
    baseUrl?: string;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}) {
    this.baseUrl = config.baseUrl || API_CONFIG.baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...config.headers,
    };
    this.timeout = config.timeout || API_CONFIG.timeout;
  }

  /**
   * Set authorization header
   */
  setAuthToken(token: string | null): void {
    if (token) {
      this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders['Authorization'];
    }
  }

  /**
   * Make a secure API request
   */
  async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    
    // Validate secure connection
    validateSecureConnection(url);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.timeout
    );

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: options.signal || controller.signal,
        credentials: 'include', // Include cookies for auth
      });

      clearTimeout(timeoutId);

      // Parse response
      let data: T;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as T;
      }

      if (!response.ok) {
        throw createApiError(
          (data as { message?: string })?.message || `Request failed with status ${response.status}`,
          response.status,
          'API_ERROR',
          data
        );
      }

      return {
        data,
        status: response.status,
        ok: response.ok,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw createApiError('Request timeout', 408, 'TIMEOUT');
        }
        throw error;
      }

      throw createApiError('Unknown error occurred', 0, 'UNKNOWN');
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const apiClient = new SecureApiClient();

// Export class for custom instances
export { SecureApiClient };

export default apiClient;

