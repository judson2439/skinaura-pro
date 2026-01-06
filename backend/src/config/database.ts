/**
 * PostgreSQL Database Configuration
 * Connection pool for efficient database access
 */

import { Pool, PoolConfig } from 'pg';
import { env } from './env.js';

// Database connection configuration
const poolConfig: PoolConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  
  // Connection pool settings
  max: 20,                    // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return error after 5 seconds if connection not available
  
  // SSL configuration for production
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
};

// Create the connection pool
export const pool = new Pool(poolConfig);

// Pool error handling
pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

pool.on('connect', () => {
  console.log('📊 New database connection established');
});

/**
 * Test database connection
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connected:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

/**
 * Execute a query with automatic client management
 */
export const query = async <T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`📊 Query executed in ${duration}ms, rows: ${result.rowCount}`);
    return result.rows as T[];
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
};

/**
 * Execute a query and return single row
 */
export const queryOne = async <T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> => {
  const rows = await query<T>(text, params);
  return rows[0] || null;
};

/**
 * Close all database connections
 */
export const closePool = async (): Promise<void> => {
  await pool.end();
  console.log('📊 Database pool closed');
};

export default {
  pool,
  query,
  queryOne,
  testConnection,
  closePool,
};

