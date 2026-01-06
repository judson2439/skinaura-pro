export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    stack?: string;
  };
}

// Re-export TLS types
export type { TLSConfig } from '../config/tls.js';

// Re-export HTTP client types
export type { 
  RequestOptions as HttpRequestOptions, 
  HttpResponse 
} from '../lib/httpClient.js';

