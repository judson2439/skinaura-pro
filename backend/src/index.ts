import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { createSecureServer } from './config/tls.js';
import { testConnection, closePool } from './config/database.js';

// Validate environment variables
validateEnv();

// Test database connection on startup
const initDatabase = async (): Promise<void> => {
  console.log('📊 Connecting to PostgreSQL database...');
  const connected = await testConnection();
  if (!connected) {
    console.warn('⚠️ Database connection failed - auth features may not work');
  }
};

/**
 * Start the server with TLS 1.2+ support
 */
const startServer = (): void => {
  let server: http.Server;
  let protocol: string;
  let port: number;

  // Force HTTP in development for easier local testing
  const useSSL = env.SSL_ENABLED && env.isProd;

  if (useSSL) {
    // Create HTTPS server with TLS 1.2+ enforcement
    server = createSecureServer(app);
    protocol = 'https';
    port = env.HTTPS_PORT;
    console.log('🔒 TLS 1.2+ enabled for all connections');
  } else {
    // Create HTTP server (development mode)
    if (env.isProd) {
      console.warn('⚠️  WARNING: Running without TLS in production is not recommended!');
    }
    console.log('📡 HTTP mode enabled for development');
    server = http.createServer(app);
    protocol = 'http';
    port = env.PORT;
  }

  server.listen(port, () => {
    console.log(`🚀 Server running on ${protocol}://localhost:${port}`);
    console.log(`📍 Environment: ${env.NODE_ENV}`);
    
    if (env.FORCE_HTTPS) {
      console.log('🔐 HTTPS enforcement: enabled');
    }
    
    if (env.MTLS_ENABLED) {
      console.log('🔑 Mutual TLS (mTLS): enabled');
    }
  });

  // Handle TLS errors
  server.on('tlsClientError', (err, tlsSocket) => {
    console.error('❌ TLS Client Error:', err.message);
    tlsSocket.destroy();
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\n🛑 Shutting down gracefully...');
    
    // Close database pool
    await closePool();
    
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    shutdown();
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
  });
};

// Initialize database and start server
initDatabase().then(() => {
  startServer();
});
