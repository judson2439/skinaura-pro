import https from 'https';
import http from 'http';
import { URL } from 'url';

/**
 * HTTP Client for outbound API requests
 */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  data: T;
}

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(options: {
    baseUrl?: string;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };
    this.timeout = options.timeout || 30000;
  }

  /**
   * Make an HTTP request
   */
  async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const url = new URL(path, this.baseUrl);
    const isHttps = url.protocol === 'https:';

    const method = options.method || 'GET';
    const headers = { ...this.defaultHeaders, ...options.headers };
    const body = options.body ? JSON.stringify(options.body) : undefined;

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body).toString();
    }

    return new Promise((resolve, reject) => {
      const requestOptions: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: options.timeout || this.timeout,
      };

      const protocol = isHttps ? https : http;
      const req = protocol.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = data ? JSON.parse(data) : null;
            resolve({
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: res.headers,
              data: parsedData as T,
            });
          } catch {
            // Return raw data if not JSON
            resolve({
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: res.headers,
              data: data as T,
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      if (body) {
        req.write(body);
      }

      req.end();
    });
  }

  /**
   * Convenience methods
   */
  async get<T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  async put<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  async patch<T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  async delete<T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

/**
 * Create a pre-configured HTTP client
 */
export const createHttpClient = (baseUrl: string, options?: {
  headers?: Record<string, string>;
  timeout?: number;
}): HttpClient => {
  return new HttpClient({
    baseUrl,
    ...options,
  });
};

export default HttpClient;
