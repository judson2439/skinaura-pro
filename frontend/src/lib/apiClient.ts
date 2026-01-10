/**
 * API Client for HTTP requests
 * Supports optional request body encryption using AES-256-GCM
 */

import { API_CONFIG } from '../config/api';
import { encryptData, isEncryptionEnabled } from './encryption';

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
 * API Client class
 */
class ApiClient {
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
   * Prepare request body (encrypt if enabled)
   */
  private async prepareBody(body: unknown): Promise<{ body: string; headers: Record<string, string> }> {
    if (!body) {
      return { body: '', headers: {} };
    }

    // Check if encryption is enabled
    if (isEncryptionEnabled()) {
      try {
        const { encrypted, iv } = await encryptData(body);
        return {
          body: JSON.stringify({ encrypted, iv }),
          headers: { 'X-Encrypted': 'true' },
        };
      } catch (error) {
        console.error('Failed to encrypt request body:', error);
        // Fall back to unencrypted if encryption fails
        return { body: JSON.stringify(body), headers: {} };
      }
    }

    return { body: JSON.stringify(body), headers: {} };
  }

  /**
   * Make an API request
   */
  async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.timeout
    );

    try {
      // Prepare body (potentially encrypted)
      const { body: preparedBody, headers: encryptionHeaders } = options.body 
        ? await this.prepareBody(options.body)
        : { body: undefined as string | undefined, headers: {} };

      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
          ...encryptionHeaders,
        },
        body: preparedBody || undefined,
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
export const apiClient = new ApiClient();

// Export class for custom instances
export { ApiClient };

export default apiClient;
