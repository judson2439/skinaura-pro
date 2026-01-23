/**
 * HIPAA Audit Logging System
 * Tracks all PHI access and modifications for compliance
 * 
 * HIPAA requires 6-year retention of audit logs
 */

import { query } from '../config/database.js';
import { Request } from 'express';

// ============================================================================
// TYPES
// ============================================================================

export type AuditAction =
  | 'VIEW'
  | 'VIEW_LIST'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'PERMISSION_DENIED'
  | 'UPLOAD'
  | 'DOWNLOAD';

export type AuditResourceType =
  | 'user_profile'
  | 'progress_photo'
  | 'treatment_plan'
  | 'routine'
  | 'skin_analysis'
  | 'message'
  | 'annotation'
  | 'comment'
  | 'product'
  | 'session'
  | 'notification'
  | 'invitation'
  | 'gamification'
  | 'badge'
  | 'avatar'
  | 'logo'
  | 'system';

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  status?: 'success' | 'failure' | 'denied';
  errorMessage?: string;
}

export interface AuditLogRecord {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: Date;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract client IP address from request
 * Handles proxies and load balancers
 */
export const getClientIp = (req: Request): string | undefined => {
  // Check X-Forwarded-For header (for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  
  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }
  
  // Fall back to req.ip or socket remote address
  return req.ip || req.socket?.remoteAddress;
};

/**
 * Extract user agent from request
 */
export const getUserAgent = (req: Request): string | undefined => {
  const ua = req.headers['user-agent'];
  // Truncate very long user agents
  if (ua && ua.length > 500) {
    return ua.substring(0, 500) + '...';
  }
  return ua;
};

/**
 * Sanitize sensitive data from details before logging
 * Never log passwords, tokens, or full PHI content
 */
const sanitizeDetails = (details?: Record<string, unknown>): Record<string, unknown> => {
  if (!details) return {};

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'accessToken',
    'refreshToken',
    'credit_card',
    'ssn',
    'social_security',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    const keyLower = key.toLowerCase();
    
    // Check if key contains sensitive words
    if (sensitiveKeys.some(sk => keyLower.includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

// ============================================================================
// MAIN LOGGING FUNCTION
// ============================================================================

/**
 * Log an audit event to the database
 * This should never throw - audit logging failures shouldn't break the app
 */
export const logAudit = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_logs (
        user_id, user_email, user_role,
        action, resource_type, resource_id,
        ip_address, user_agent,
        details, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9, $10, $11)`,
      [
        entry.userId || null,
        entry.userEmail || null,
        entry.userRole || null,
        entry.action,
        entry.resourceType,
        entry.resourceId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        JSON.stringify(sanitizeDetails(entry.details)),
        entry.status || 'success',
        entry.errorMessage || null,
      ]
    );
  } catch (error) {
    // Log to console but don't throw - audit failures shouldn't break the app
    console.error('❌ Audit logging failed:', error);
    console.error('Audit entry:', JSON.stringify({
      ...entry,
      details: sanitizeDetails(entry.details),
    }, null, 2));
  }
};

/**
 * Convenience function to log from a request context
 * Automatically extracts user info, IP, and user agent from the request
 */
export const logAuditFromRequest = async (
  req: Request,
  action: AuditAction,
  resourceType: AuditResourceType,
  resourceId?: string,
  details?: Record<string, unknown>,
  status: 'success' | 'failure' | 'denied' = 'success',
  errorMessage?: string
): Promise<void> => {
  const userId = (req as any).userId;
  const userEmail = (req as any).userEmail;
  const userRole = (req as any).userRole;

  await logAudit({
    userId,
    userEmail,
    userRole,
    action,
    resourceType,
    resourceId,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    details,
    status,
    errorMessage,
  });
};

// ============================================================================
// QUERY FUNCTIONS FOR ADMIN
// ============================================================================

export interface AuditLogQueryParams {
  userId?: string;
  userEmail?: string;
  resourceType?: string;
  action?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query audit logs with filters
 */
export const queryAuditLogs = async (
  params: AuditLogQueryParams
): Promise<{ logs: AuditLogRecord[]; total: number }> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(params.userId);
  }

  if (params.userEmail) {
    conditions.push(`user_email ILIKE $${paramIndex++}`);
    values.push(`%${params.userEmail}%`);
  }

  if (params.resourceType) {
    conditions.push(`resource_type = $${paramIndex++}`);
    values.push(params.resourceType);
  }

  if (params.action) {
    conditions.push(`action = $${paramIndex++}`);
    values.push(params.action);
  }

  if (params.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(params.status);
  }

  if (params.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    values.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    values.push(params.endDate);
  }

  if (params.ipAddress) {
    conditions.push(`ip_address = $${paramIndex++}::inet`);
    values.push(params.ipAddress);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = params.limit || 100;
  const offset = params.offset || 0;

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
    values
  );
  const total = parseInt(countResult[0]?.count || '0', 10);

  // Get logs
  const logs = await query<AuditLogRecord>(
    `SELECT * FROM audit_logs 
     ${whereClause} 
     ORDER BY created_at DESC 
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  );

  return { logs, total };
};

/**
 * Get audit log statistics
 */
export const getAuditStats = async (
  startDate?: string,
  endDate?: string
): Promise<{
  totalEvents: number;
  byAction: { action: string; count: number }[];
  byResource: { resource_type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  topUsers: { user_email: string; count: number }[];
}> => {
  const dateCondition = startDate && endDate
    ? `WHERE created_at >= $1 AND created_at <= $2`
    : startDate
      ? `WHERE created_at >= $1`
      : endDate
        ? `WHERE created_at <= $1`
        : '';
  
  const dateParams = [startDate, endDate].filter(Boolean);

  // Total events
  const totalResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs ${dateCondition}`,
    dateParams
  );

  // By action
  const byAction = await query<{ action: string; count: string }>(
    `SELECT action, COUNT(*) as count FROM audit_logs ${dateCondition} GROUP BY action ORDER BY count DESC`,
    dateParams
  );

  // By resource type
  const byResource = await query<{ resource_type: string; count: string }>(
    `SELECT resource_type, COUNT(*) as count FROM audit_logs ${dateCondition} GROUP BY resource_type ORDER BY count DESC`,
    dateParams
  );

  // By status
  const byStatus = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count FROM audit_logs ${dateCondition} GROUP BY status ORDER BY count DESC`,
    dateParams
  );

  // Top users
  const topUsers = await query<{ user_email: string; count: string }>(
    `SELECT user_email, COUNT(*) as count FROM audit_logs 
     ${dateCondition ? dateCondition + ' AND' : 'WHERE'} user_email IS NOT NULL 
     GROUP BY user_email ORDER BY count DESC LIMIT 10`,
    dateParams
  );

  return {
    totalEvents: parseInt(totalResult[0]?.count || '0', 10),
    byAction: byAction.map(r => ({ action: r.action, count: parseInt(r.count, 10) })),
    byResource: byResource.map(r => ({ resource_type: r.resource_type, count: parseInt(r.count, 10) })),
    byStatus: byStatus.map(r => ({ status: r.status, count: parseInt(r.count, 10) })),
    topUsers: topUsers.map(r => ({ user_email: r.user_email, count: parseInt(r.count, 10) })),
  };
};

export default {
  logAudit,
  logAuditFromRequest,
  getClientIp,
  getUserAgent,
  queryAuditLogs,
  getAuditStats,
};
