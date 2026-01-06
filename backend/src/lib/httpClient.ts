import https from 'https';
import http from 'http';
import { URL } from 'url';
import tls from 'tls';
import { getClientTLSOptions } from '../config/tls.js';

/**
 * Secure HTTP Client with TLS 1.2+ enforcement
 * Use this for all outbound API requests
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

export class SecureHttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private httpsAgent: https.Agent;

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

    // Create HTTPS agent with TLS 1.2+ enforcement
    const tlsOptions = getClientTLSOptions();
    this.httpsAgent = new https.Agent({
      minVersion: tlsOptions.minVersion,
      maxVersion: tlsOptions.maxVersion,
      ciphers: tlsOptions.ciphers,
      rejectUnauthorized: tlsOptions.rejectUnauthorized,
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 50,
      maxFreeSockets: 10,
    });
  }

  /**
   * Make a secure HTTP request with TLS 1.2+ enforcement
   */
  async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const url = new URL(path, this.baseUrl);
    const isHttps = url.protocol === 'https:';

    // Enforce HTTPS for non-localhost URLs
    if (!isHttps && !this.isLocalhost(url.hostname)) {
      throw new Error(`HTTPS required for non-localhost requests: ${url.toString()}`);
    }

    const method = options.method || 'GET';
    const headers = { ...this.defaultHeaders, ...options.headers };
    const body = options.body ? JSON.stringify(options.body) : undefined;

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body).toString();
    }

    return new Promise((resolve, reject) => {
      const requestOptions: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout: options.timeout || this.timeout,
        ...(isHttps && {
          agent: this.httpsAgent,
          ...getClientTLSOptions(),
        }),
      };

      const protocol = isHttps ? https : http;
      const req = protocol.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          // Verify TLS version for HTTPS connections
          if (isHttps && res.socket instanceof tls.TLSSocket) {
            const protocol = res.socket.getProtocol();
            const tlsVersion = protocol ? parseFloat(protocol.replace('TLSv', '')) : 0;
            
            if (tlsVersion < 1.2) {
              reject(new Error(`TLS version ${protocol} not allowed. Minimum: TLSv1.2`));
              return;
            }
          }

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

      // Verify TLS on secure connection
      if (isHttps) {
        req.on('socket', (socket) => {
          socket.on('secureConnect', () => {
            if (socket instanceof tls.TLSSocket) {
              const protocol = socket.getProtocol();
              console.log(`🔒 TLS connection established: ${protocol}`);
            }
          });
        });
      }

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

  private isLocalhost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }

  /**
   * Close the HTTPS agent connections
   */
  destroy(): void {
    this.httpsAgent.destroy();
  }
}

/**
 * Create a pre-configured secure HTTP client
 */
export const createSecureClient = (baseUrl: string, options?: {
  headers?: Record<string, string>;
  timeout?: number;
}): SecureHttpClient => {
  return new SecureHttpClient({
    baseUrl,
    ...options,
  });
};

export default SecureHttpClient;

