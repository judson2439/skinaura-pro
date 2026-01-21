/**
 * PM2 Ecosystem Configuration
 * Run with: pm2 start ecosystem.config.cjs
 */

module.exports = {
  apps: [
    // ============================================
    // BACKEND API SERVER
    // ============================================
    {
      name: 'skinaura-backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      // Restart delays
      restart_delay: 4000,
      min_uptime: '10s',
      max_restarts: 10,
    },

    // ============================================
    // FRONTEND (Vite Preview Server)
    // ============================================
    {
      name: 'skinaura-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'vite preview --host 0.0.0.0 --port 8000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      merge_logs: true,
      // Restart delays
      restart_delay: 4000,
      min_uptime: '10s',
      max_restarts: 10,
    },
  ],
};
