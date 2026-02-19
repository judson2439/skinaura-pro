import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { env, validateEnv } from './config/env.js';
import { testConnection, closePool } from './config/database.js';
import { initLoginAttemptsTable } from './lib/accountLockout.js';
import { initProfessionalInvitationNotificationsTable, initProfessionalPdfUploadsTable, initTreatmentPlanPdfsTable } from './routes/professional.js';

// Validate environment variables
validateEnv();

// Test database connection on startup
const initDatabase = async (): Promise<void> => {
  console.log('📊 Connecting to PostgreSQL database...');
  const connected = await testConnection();
  if (!connected) {
    console.warn('⚠️ Database connection failed - auth features may not work');
    return;
  }

  // Initialize login attempts table for account lockout feature
  await initLoginAttemptsTable();
  
  // Initialize professional invitation notifications table
  await initProfessionalInvitationNotificationsTable();

  // Initialize professional PDF uploads table
  await initProfessionalPdfUploadsTable();

  // Initialize treatment plan PDFs junction table
  await initTreatmentPlanPdfsTable();
};

/**
 * Start the HTTP server
 */
const startServer = (): void => {
  const port = env.PORT;
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📍 Environment: ${env.NODE_ENV}`);
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
