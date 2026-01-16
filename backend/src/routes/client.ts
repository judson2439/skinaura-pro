/**
 * Client routes for managing routines, gamification, and completions.
 * Uses PostgreSQL for data storage.
 */

import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { verifyToken } from '../lib/auth.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface UserGamification {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  total_routines_completed: number;
  level: string;
  last_completion_date: string | null;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_name: string;
  badge_description: string | null;
  badge_icon: string | null;
  earned_at: string;
}

interface RoutineTemplate {
  id: string;
  professional_id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_days: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoutineStep {
  id: string;
  routine_id: string;
  step_order: number;
  step_name: string;
  description: string | null;
  duration_seconds: number | null;
  product_category: string | null;
  product_recommendation: string | null;
  tips: string | null;
  is_optional: boolean;
  created_at: string;
}

interface RoutineCompletion {
  id: string;
  client_id: string;
  completion_date: string;
  routine_type: string;
  completed_at: string;
}

interface StepCompletion {
  id: string;
  client_id: string;
  routine_step_id: string;
  completion_date: string;
  completed_at: string;
}

interface StepProduct {
  id: string;
  routine_step_id: string;
  product_id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  purchase_url: string | null;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Auth middleware to verify JWT token and extract user ID
 */
const authMiddleware = async (
  req: Request,
  res: Response,
  next: () => void
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization token required',
      } as ApiResponse);
      return;
    }

    const token = authHeader.split(' ')[1];
    const result = verifyToken(token);

    if (!result.valid || !result.payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      } as ApiResponse);
      return;
    }

    // Attach user info to request
    (req as any).userId = result.payload.sub as string;
    (req as any).userEmail = result.payload.email as string;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    } as ApiResponse);
  }
};

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================================================
// GAMIFICATION ENDPOINTS
// ============================================================================

/**
 * GET /client/gamification
 * Get gamification data for the authenticated user
 */
router.get('/gamification', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📊 Fetching gamification data for user: ${userId}`);

    const gamification = await queryOne<UserGamification>(
      `SELECT * FROM user_gamification WHERE user_id = $1`,
      [userId]
    );

    if (!gamification) {
      console.log(`ℹ️ No gamification record found for user: ${userId}`);
      res.status(200).json({
        success: true,
        data: { gamification: null },
      } as ApiResponse);
      return;
    }

    console.log(`✅ Gamification data fetched`);

    res.status(200).json({
      success: true,
      data: { gamification },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching gamification data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gamification data',
    } as ApiResponse);
  }
});

/**
 * POST /client/gamification
 * Create initial gamification record for user
 */
router.post('/gamification', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📝 Creating gamification record for user: ${userId}`);

    // Check if record already exists
    const existing = await queryOne<UserGamification>(
      `SELECT * FROM user_gamification WHERE user_id = $1`,
      [userId]
    );

    if (existing) {
      res.status(200).json({
        success: true,
        data: { gamification: existing },
        message: 'Gamification record already exists',
      } as ApiResponse);
      return;
    }

    // Create new record
    const newRecord = await queryOne<UserGamification>(
      `INSERT INTO user_gamification (
        user_id, points, level, current_streak, longest_streak, 
        total_routines_completed, created_at, updated_at
      ) VALUES ($1, 0, 'Bronze', 0, 0, 0, NOW(), NOW())
      RETURNING *`,
      [userId]
    );

    console.log(`✅ Gamification record created`);

    res.status(201).json({
      success: true,
      data: { gamification: newRecord },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error creating gamification record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create gamification record',
    } as ApiResponse);
  }
});

/**
 * PATCH /client/gamification
 * Update gamification data (points, streak, level, etc.)
 */
router.patch('/gamification', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { points, level, current_streak, longest_streak, total_routines_completed, last_completion_date } = req.body;

    console.log(`📝 Updating gamification for user: ${userId}`);

    const result = await queryOne<UserGamification>(
      `INSERT INTO user_gamification (
        user_id, points, level, current_streak, longest_streak, 
        total_routines_completed, last_completion_date, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        points = COALESCE($2, user_gamification.points),
        level = COALESCE($3, user_gamification.level),
        current_streak = COALESCE($4, user_gamification.current_streak),
        longest_streak = COALESCE($5, user_gamification.longest_streak),
        total_routines_completed = COALESCE($6, user_gamification.total_routines_completed),
        last_completion_date = COALESCE($7, user_gamification.last_completion_date),
        updated_at = NOW()
      RETURNING *`,
      [userId, points, level, current_streak, longest_streak, total_routines_completed, last_completion_date]
    );

    console.log(`✅ Gamification updated`);

    res.status(200).json({
      success: true,
      data: { gamification: result },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating gamification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update gamification',
    } as ApiResponse);
  }
});

// ============================================================================
// BADGES ENDPOINTS
// ============================================================================

/**
 * GET /client/badges
 * Get all badges for the authenticated user
 */
router.get('/badges', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📊 Fetching badges for user: ${userId}`);

    const badges = await query<UserBadge>(
      `SELECT * FROM user_badges WHERE user_id = $1 ORDER BY earned_at DESC`,
      [userId]
    );

    console.log(`✅ Found ${badges.length} badges`);

    res.status(200).json({
      success: true,
      data: { badges },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching badges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch badges',
    } as ApiResponse);
  }
});

// ============================================================================
// ROUTINES ENDPOINTS
// ============================================================================

/**
 * GET /client/routines
 * Get all assigned routines with steps and products for the authenticated user
 */
router.get('/routines', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📊 Fetching routines for client: ${userId}`);

    // Step 1: Get all active routine assignments
    const assignments = await query<{
      id: string;
      routine_id: string;
      professional_id: string;
      assigned_at: string;
      notes: string | null;
    }>(
      `SELECT id, routine_id, professional_id, assigned_at, notes
       FROM client_routine_assignments
       WHERE client_id = $1 AND is_active = true`,
      [userId]
    );

    if (assignments.length === 0) {
      console.log(`ℹ️ No routines assigned to client: ${userId}`);
      res.status(200).json({
        success: true,
        data: { routines: [], professionals: [] },
      } as ApiResponse);
      return;
    }

    const routineIds = [...new Set(assignments.map(a => a.routine_id))];
    const professionalIds = [...new Set(assignments.map(a => a.professional_id))];

    // Step 2: Get routine templates
    const routines = await query<RoutineTemplate>(
      `SELECT * FROM routine_templates WHERE id = ANY($1) AND is_active = true`,
      [routineIds]
    );

    // Step 3: Get professionals
    const professionals = await query<{
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
    }>(
      `SELECT id, email, full_name, avatar_url FROM user_profiles WHERE id = ANY($1)`,
      [professionalIds]
    );

    // Step 4: Get all routine steps
    const steps = await query<RoutineStep>(
      `SELECT * FROM routine_steps WHERE routine_id = ANY($1) ORDER BY step_order ASC`,
      [routineIds]
    );

    // Step 5: Get step products with product details
    const stepIds = steps.map(s => s.id);
    let stepProducts: StepProduct[] = [];

    if (stepIds.length > 0) {
      stepProducts = await query<StepProduct>(
        `SELECT 
          rsp.id,
          rsp.routine_step_id,
          rsp.product_id,
          p.name,
          p.brand,
          p.image_url,
          p.purchase_url
         FROM routine_step_products rsp
         JOIN products p ON rsp.product_id = p.id
         WHERE rsp.routine_step_id = ANY($1)`,
        [stepIds]
      );
    }

    // Build response structure
    const stepsMap = new Map<string, RoutineStep[]>();
    steps.forEach(step => {
      const existing = stepsMap.get(step.routine_id) || [];
      existing.push(step);
      stepsMap.set(step.routine_id, existing);
    });

    const stepProductsMap = new Map<string, StepProduct[]>();
    stepProducts.forEach(sp => {
      const existing = stepProductsMap.get(sp.routine_step_id) || [];
      existing.push(sp);
      stepProductsMap.set(sp.routine_step_id, existing);
    });

    const routinesWithDetails = routines.map(routine => {
      const assignment = assignments.find(a => a.routine_id === routine.id);
      const routineSteps = stepsMap.get(routine.id) || [];
      
      return {
        ...routine,
        assigned_at: assignment?.assigned_at,
        assignment_notes: assignment?.notes,
        steps: routineSteps.map(step => ({
          ...step,
          products: stepProductsMap.get(step.id) || [],
        })),
      };
    });

    const professionalsFormatted = professionals.map(p => ({
      id: p.id,
      name: p.full_name || p.email,
      email: p.email,
      avatarUrl: p.avatar_url,
    }));

    console.log(`✅ Found ${routinesWithDetails.length} routines`);

    res.status(200).json({
      success: true,
      data: { 
        routines: routinesWithDetails,
        professionals: professionalsFormatted,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching routines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch routines',
    } as ApiResponse);
  }
});

// ============================================================================
// COMPLETIONS ENDPOINTS
// ============================================================================

/**
 * GET /client/completions/today
 * Get today's routine and step completions
 */
router.get('/completions/today', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const today = new Date().toISOString().split('T')[0];

    console.log(`📊 Fetching today's completions for user: ${userId}`);

    // Get routine completions
    const routineCompletions = await query<RoutineCompletion>(
      `SELECT * FROM routine_completions 
       WHERE client_id = $1 AND completion_date = $2`,
      [userId, today]
    );

    // Get step completions
    const stepCompletions = await query<StepCompletion>(
      `SELECT * FROM routine_step_completions 
       WHERE client_id = $1 AND completion_date = $2`,
      [userId, today]
    );

    console.log(`✅ Found ${routineCompletions.length} routine completions, ${stepCompletions.length} step completions`);

    res.status(200).json({
      success: true,
      data: {
        routineCompletions,
        stepCompletions,
        completedRoutineTypes: routineCompletions.map(rc => rc.routine_type),
        completedStepIds: stepCompletions.map(sc => sc.routine_step_id),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching completions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch completions',
    } as ApiResponse);
  }
});

/**
 * POST /client/step-completions
 * Add a step completion
 */
router.post('/step-completions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { step_id, completion_date } = req.body;
    const date = completion_date || new Date().toISOString().split('T')[0];

    console.log(`📝 Adding step completion for user: ${userId}, step: ${step_id}`);

    const result = await queryOne<StepCompletion>(
      `INSERT INTO routine_step_completions (client_id, routine_step_id, completion_date, completed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (client_id, routine_step_id, completion_date) DO NOTHING
       RETURNING *`,
      [userId, step_id, date]
    );

    console.log(`✅ Step completion added`);

    res.status(201).json({
      success: true,
      data: { completion: result },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding step completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add step completion',
    } as ApiResponse);
  }
});

/**
 * DELETE /client/step-completions/:stepId
 * Remove a step completion for today
 */
router.delete('/step-completions/:stepId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const stepId = req.params.stepId;
    const today = new Date().toISOString().split('T')[0];

    console.log(`🗑️ Removing step completion for user: ${userId}, step: ${stepId}`);

    await query(
      `DELETE FROM routine_step_completions 
       WHERE client_id = $1 AND routine_step_id = $2 AND completion_date = $3`,
      [userId, stepId, today]
    );

    console.log(`✅ Step completion removed`);

    res.status(200).json({
      success: true,
      message: 'Step completion removed',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error removing step completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove step completion',
    } as ApiResponse);
  }
});

/**
 * POST /client/step-completions/batch
 * Add multiple step completions at once
 */
router.post('/step-completions/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { step_ids, completion_date } = req.body;
    const date = completion_date || new Date().toISOString().split('T')[0];

    if (!Array.isArray(step_ids) || step_ids.length === 0) {
      res.status(400).json({
        success: false,
        error: 'step_ids must be a non-empty array',
      } as ApiResponse);
      return;
    }

    console.log(`📝 Adding ${step_ids.length} step completions for user: ${userId}`);

    // Build values for batch insert
    const values: unknown[] = [];
    const placeholders: string[] = [];
    step_ids.forEach((stepId: string, index: number) => {
      const offset = index * 3;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, NOW())`);
      values.push(userId, stepId, date);
    });

    await query(
      `INSERT INTO routine_step_completions (client_id, routine_step_id, completion_date, completed_at)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (client_id, routine_step_id, completion_date) DO NOTHING`,
      values
    );

    console.log(`✅ Batch step completions added`);

    res.status(201).json({
      success: true,
      message: `${step_ids.length} step completions added`,
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding batch step completions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add step completions',
    } as ApiResponse);
  }
});

/**
 * POST /client/routine-completions
 * Mark a routine type as completed for today
 */
router.post('/routine-completions', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { routine_type, completion_date } = req.body;
    const date = completion_date || new Date().toISOString().split('T')[0];

    if (!routine_type) {
      res.status(400).json({
        success: false,
        error: 'routine_type is required',
      } as ApiResponse);
      return;
    }

    console.log(`📝 Completing routine ${routine_type} for user: ${userId}`);

    const result = await queryOne<RoutineCompletion>(
      `INSERT INTO routine_completions (client_id, completion_date, routine_type, completed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (client_id, completion_date, routine_type) DO NOTHING
       RETURNING *`,
      [userId, date, routine_type]
    );

    console.log(`✅ Routine completion added`);

    res.status(201).json({
      success: true,
      data: { completion: result },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding routine completion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add routine completion',
    } as ApiResponse);
  }
});

// ============================================================================
// NOTIFICATIONS ENDPOINTS
// ============================================================================

/**
 * GET /client/notifications/unread-count
 * Get count of unread notifications (messages from professionals)
 */
router.get('/notifications/unread-count', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📊 Fetching unread notifications for client: ${userId}`);

    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM routine_notes 
       WHERE client_id = $1 
         AND read_status = false 
         AND client_deleted = false
         AND sender_type = 'professional'`,
      [userId]
    );

    const count = parseInt(result[0]?.count || '0', 10);

    console.log(`✅ Unread notifications count: ${count}`);

    res.status(200).json({
      success: true,
      data: { count },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching unread notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread notifications count',
    } as ApiResponse);
  }
});

/**
 * GET /client/notifications/recent
 * Get recent unread notifications for the header dropdown
 */
router.get('/notifications/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 5;

    console.log(`🔔 Fetching recent unread notifications for client: ${userId}`);

    // Fetch recent unread messages from professionals
    const notifications = await query<{
      id: string;
      professional_id: string;
      content: string;
      created_at: string;
    }>(
      `SELECT id, professional_id, content, created_at
       FROM routine_notes
       WHERE client_id = $1 
         AND client_deleted = false
         AND sender_type = 'professional'
         AND read_status = false
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    if (notifications.length === 0) {
      console.log(`ℹ️ No recent unread notifications for client: ${userId}`);
      res.status(200).json({
        success: true,
        data: { notifications: [] },
      } as ApiResponse);
      return;
    }

    // Get unique professional IDs
    const professionalIds = [...new Set(notifications.map(n => n.professional_id))];

    // Fetch professional profiles
    const professionals = await query<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    }>(
      `SELECT id, full_name, avatar_url FROM user_profiles WHERE id = ANY($1)`,
      [professionalIds]
    );

    const professionalsMap = new Map(professionals.map(p => [p.id, p]));

    // Map notifications with professional info
    const notificationsWithProfessionals = notifications.map(n => {
      const professional = professionalsMap.get(n.professional_id);
      return {
        id: n.id,
        professional_id: n.professional_id,
        professional_name: professional?.full_name || 'Your Professional',
        professional_avatar: professional?.avatar_url || null,
        content: n.content,
        created_at: n.created_at,
      };
    });

    console.log(`✅ Found ${notificationsWithProfessionals.length} recent unread notifications`);

    res.status(200).json({
      success: true,
      data: { notifications: notificationsWithProfessionals },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching recent notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent notifications',
    } as ApiResponse);
  }
});

/**
 * GET /client/notifications
 * Get all notifications for a client
 */
router.get('/notifications', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    console.log(`📊 Fetching notifications for client: ${userId}`);

    const notifications = await query<{
      id: string;
      professional_id: string;
      note: string;
      sender_type: string;
      read_status: boolean;
      created_at: string;
      professional_name: string;
      professional_avatar: string | null;
    }>(
      `SELECT rn.*, up.full_name as professional_name, up.avatar_url as professional_avatar
       FROM routine_notes rn
       LEFT JOIN user_profiles up ON rn.professional_id = up.id
       WHERE rn.client_id = $1 
         AND rn.client_deleted = false
         AND rn.sender_type = 'professional'
       ORDER BY rn.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    console.log(`✅ Found ${notifications.length} notifications`);

    res.status(200).json({
      success: true,
      data: { notifications },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    } as ApiResponse);
  }
});

/**
 * PATCH /client/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/notifications/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const notificationId = req.params.id;

    console.log(`📝 Marking notification ${notificationId} as read`);

    await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE id = $1 AND client_id = $2`,
      [notificationId, userId]
    );

    console.log(`✅ Notification marked as read`);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
    } as ApiResponse);
  }
});

/**
 * PATCH /client/notifications/mark-all-read
 * Mark all notifications from professionals as read
 */
router.patch('/notifications/mark-all-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📝 Marking all notifications as read for client: ${userId}`);

    await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE client_id = $1 
         AND sender_type = 'professional' 
         AND read_status = false`,
      [userId]
    );

    console.log(`✅ All notifications marked as read`);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    } as ApiResponse);
  }
});

// ============================================================================
// CONVERSATIONS/CHAT ENDPOINTS
// ============================================================================

interface ConversationGroup {
  professional_id: string;
  professional_name: string;
  professional_avatar: string | null;
  unread_count: number;
  total_count: number;
  last_message: string;
  last_message_time: string;
  last_sender_type: string;
}

/**
 * GET /client/conversations
 * Get all conversations grouped by professional
 */
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📊 Fetching conversations for client: ${userId}`);

    // Get all notes for this client grouped by professional
    const conversationData = await query<{
      professional_id: string;
      total_count: string;
      unread_count: string;
      last_message: string;
      last_message_time: string;
      last_sender_type: string;
    }>(
      `SELECT 
        rn.professional_id,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE rn.sender_type = 'professional' AND rn.read_status = false) as unread_count,
        (SELECT content FROM routine_notes rn2 
         WHERE rn2.client_id = $1 
           AND rn2.professional_id = rn.professional_id 
           AND rn2.client_deleted = false 
         ORDER BY rn2.created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM routine_notes rn2 
         WHERE rn2.client_id = $1 
           AND rn2.professional_id = rn.professional_id 
           AND rn2.client_deleted = false 
         ORDER BY rn2.created_at DESC LIMIT 1) as last_message_time,
        (SELECT sender_type FROM routine_notes rn2 
         WHERE rn2.client_id = $1 
           AND rn2.professional_id = rn.professional_id 
           AND rn2.client_deleted = false 
         ORDER BY rn2.created_at DESC LIMIT 1) as last_sender_type
       FROM routine_notes rn
       WHERE rn.client_id = $1 AND rn.client_deleted = false
       GROUP BY rn.professional_id`,
      [userId]
    );

    if (conversationData.length === 0) {
      console.log(`ℹ️ No conversations found for client: ${userId}`);
      res.status(200).json({
        success: true,
        data: { conversations: [] },
      } as ApiResponse);
      return;
    }

    // Get professional profiles
    const professionalIds = conversationData.map(c => c.professional_id);
    const professionals = await query<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    }>(
      `SELECT id, full_name, avatar_url FROM user_profiles WHERE id = ANY($1)`,
      [professionalIds]
    );

    const professionalsMap = new Map(professionals.map(p => [p.id, p]));

    // Build conversation groups
    const conversations: ConversationGroup[] = conversationData.map(c => {
      const professional = professionalsMap.get(c.professional_id);
      return {
        professional_id: c.professional_id,
        professional_name: professional?.full_name || 'Professional',
        professional_avatar: professional?.avatar_url || null,
        unread_count: parseInt(c.unread_count, 10),
        total_count: parseInt(c.total_count, 10),
        last_message: c.last_message || '',
        last_message_time: c.last_message_time || '',
        last_sender_type: c.last_sender_type || 'professional',
      };
    });

    // Sort by unread count desc, then by last message time desc
    conversations.sort((a, b) => {
      if (b.unread_count !== a.unread_count) {
        return b.unread_count - a.unread_count;
      }
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });

    console.log(`✅ Found ${conversations.length} conversations`);

    res.status(200).json({
      success: true,
      data: { conversations },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
    } as ApiResponse);
  }
});

interface ChatMessage {
  id: string;
  client_id: string;
  professional_id: string;
  content: string;
  sender_type: string;
  read_status: boolean;
  created_at: string;
}

/**
 * GET /client/conversations/:professionalId/messages
 * Get chat messages with a specific professional
 */
router.get('/conversations/:professionalId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const professionalId = req.params.professionalId;

    console.log(`📊 Fetching messages between client ${userId} and professional ${professionalId}`);

    const messages = await query<ChatMessage>(
      `SELECT id, client_id, professional_id, content, sender_type, read_status, created_at
       FROM routine_notes
       WHERE client_id = $1 
         AND professional_id = $2 
         AND client_deleted = false
       ORDER BY created_at ASC`,
      [userId, professionalId]
    );

    console.log(`✅ Found ${messages.length} messages`);

    res.status(200).json({
      success: true,
      data: { messages },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
    } as ApiResponse);
  }
});

/**
 * POST /client/conversations/:professionalId/messages
 * Send a message to a professional
 */
router.post('/conversations/:professionalId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const professionalId = req.params.professionalId;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Message content is required',
      } as ApiResponse);
      return;
    }

    if (content.length > 1000) {
      res.status(400).json({
        success: false,
        error: 'Message content must be 1000 characters or less',
      } as ApiResponse);
      return;
    }

    console.log(`📝 Sending message from client ${userId} to professional ${professionalId}`);

    const newMessage = await queryOne<ChatMessage>(
      `INSERT INTO routine_notes (
        client_id, professional_id, content, sender_type, 
        read_status, client_deleted, professional_deleted, created_at
      ) VALUES ($1, $2, $3, 'client', false, false, false, NOW())
      RETURNING id, client_id, professional_id, content, sender_type, read_status, created_at`,
      [userId, professionalId, content.trim()]
    );

    console.log(`✅ Message sent`);

    res.status(201).json({
      success: true,
      data: { message: newMessage },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
    } as ApiResponse);
  }
});

/**
 * PATCH /client/conversations/:professionalId/mark-read
 * Mark all messages from a specific professional as read
 */
router.patch('/conversations/:professionalId/mark-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const professionalId = req.params.professionalId;

    console.log(`📝 Marking messages from professional ${professionalId} as read for client ${userId}`);

    await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE client_id = $1 
         AND professional_id = $2 
         AND sender_type = 'professional' 
         AND read_status = false`,
      [userId, professionalId]
    );

    console.log(`✅ Messages marked as read`);

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read',
    } as ApiResponse);
  }
});

/**
 * PATCH /client/messages/:messageId/read
 * Mark a single message as read
 */
router.patch('/messages/:messageId/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const messageId = req.params.messageId;

    console.log(`📝 Marking message ${messageId} as read`);

    await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE id = $1 AND client_id = $2`,
      [messageId, userId]
    );

    console.log(`✅ Message marked as read`);

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error marking message as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark message as read',
    } as ApiResponse);
  }
});

// ============================================================================
// CLIENT PRODUCTS ROUTES
// ============================================================================

interface ClientProduct {
  id: string;
  client_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  notes: string | null;
  image_url: string | null;
  purchase_date: string | null;
  expiry_date: string | null;
  is_active: boolean;
  rating: number | null;
  created_at: string;
  updated_at: string | null;
}

// GET /client/products - Get all products for the client
router.get('/products', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📦 Fetching products for client: ${userId}`);

    const products = await query<ClientProduct>(
      `SELECT * FROM client_products 
       WHERE client_id = $1 AND is_active = true 
       ORDER BY created_at DESC`,
      [userId]
    );

    console.log(`✅ Found ${products.length} products`);

    res.status(200).json({
      success: true,
      data: { products },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
    } as ApiResponse);
  }
});

// POST /client/products - Add a new product
router.post('/products', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { name, brand, category, description, notes, image_url, purchase_date, expiry_date, rating } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'Product name is required',
      } as ApiResponse);
      return;
    }

    console.log(`➕ Adding product for client: ${userId}, name: ${name}`);

    const product = await queryOne<ClientProduct>(
      `INSERT INTO client_products 
       (client_id, name, brand, category, description, notes, image_url, purchase_date, expiry_date, rating, is_active, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW()) 
       RETURNING *`,
      [
        userId,
        name.trim(),
        brand?.trim() || null,
        category || null,
        description?.trim() || null,
        notes?.trim() || null,
        image_url || null,
        purchase_date || null,
        expiry_date || null,
        rating || null,
      ]
    );

    console.log(`✅ Product added: ${product?.id}`);

    res.status(201).json({
      success: true,
      data: { product },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add product',
    } as ApiResponse);
  }
});

// PUT /client/products/:productId - Update a product
router.put('/products/:productId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const productId = req.params.productId;
    const { name, brand, category, description, notes, image_url, purchase_date, expiry_date, rating } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'Product name is required',
      } as ApiResponse);
      return;
    }

    console.log(`✏️ Updating product ${productId} for client: ${userId}`);

    const product = await queryOne<ClientProduct>(
      `UPDATE client_products 
       SET name = $1, brand = $2, category = $3, description = $4, notes = $5, 
           image_url = $6, purchase_date = $7, expiry_date = $8, rating = $9, updated_at = NOW() 
       WHERE id = $10 AND client_id = $11 
       RETURNING *`,
      [
        name.trim(),
        brand?.trim() || null,
        category || null,
        description?.trim() || null,
        notes?.trim() || null,
        image_url || null,
        purchase_date || null,
        expiry_date || null,
        rating || null,
        productId,
        userId,
      ]
    );

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Product updated: ${productId}`);

    res.status(200).json({
      success: true,
      data: { product },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    } as ApiResponse);
  }
});

// DELETE /client/products/:productId - Soft delete a product
router.delete('/products/:productId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const productId = req.params.productId;

    console.log(`🗑️ Deleting product ${productId} for client: ${userId}`);

    // Get the product first to check ownership and get image_url
    const existingProduct = await queryOne<ClientProduct>(
      `SELECT * FROM client_products WHERE id = $1 AND client_id = $2`,
      [productId, userId]
    );

    if (!existingProduct) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      } as ApiResponse);
      return;
    }

    // Soft delete (set is_active to false)
    await query(
      `UPDATE client_products 
       SET is_active = false, updated_at = NOW() 
       WHERE id = $1 AND client_id = $2`,
      [productId, userId]
    );

    console.log(`✅ Product soft-deleted: ${productId}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: { image_url: existingProduct.image_url },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
    } as ApiResponse);
  }
});

// ============================================================================
// PROGRESS PHOTOS ROUTES
// ============================================================================

interface ProgressPhoto {
  id: string;
  client_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  notes: string | null;
  skin_analysis: Record<string, unknown> | null;
  tags: string[] | null;
  taken_at: string;
  created_at: string;
  updated_at: string;
  photo_type: string | null;
  title: string | null;
}

interface PhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  markup_image: string | null;
  created_at: string;
  updated_at: string;
  professional_name?: string;
}

interface PhotoComment {
  id: string;
  photo_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  professional_name?: string;
  professional_avatar?: string;
}

// GET /client/progress-photos - Get all progress photos for the client
router.get('/progress-photos', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📸 Fetching progress photos for client: ${userId}`);

    const photos = await query<ProgressPhoto>(
      `SELECT * FROM progress_photos 
       WHERE client_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    // Get photo IDs for metadata fetch
    const photoIds = photos.map(p => p.id);
    
    let metadata: Record<string, { hasAnnotations: boolean; hasComments: boolean }> = {};
    
    if (photoIds.length > 0) {
      // Fetch annotations existence
      const annotations = await query<{ photo_id: string }>(
        `SELECT DISTINCT photo_id FROM photo_annotations WHERE photo_id = ANY($1)`,
        [photoIds]
      );
      
      // Fetch comments existence
      const comments = await query<{ photo_id: string }>(
        `SELECT DISTINCT photo_id FROM photo_comments WHERE photo_id = ANY($1)`,
        [photoIds]
      );
      
      photoIds.forEach(id => {
        metadata[id] = {
          hasAnnotations: annotations.some(a => a.photo_id === id),
          hasComments: comments.some(c => c.photo_id === id),
        };
      });
    }

    console.log(`✅ Found ${photos.length} progress photos`);

    res.status(200).json({
      success: true,
      data: { photos, metadata },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching progress photos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress photos',
    } as ApiResponse);
  }
});

// POST /client/progress-photos - Upload a new progress photo
router.post('/progress-photos', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { photo_url, photo_type, title, notes, thumbnail_url, tags } = req.body;

    if (!photo_url) {
      res.status(400).json({
        success: false,
        error: 'Photo URL is required',
      } as ApiResponse);
      return;
    }

    console.log(`📸 Adding progress photo for client: ${userId}`);

    const photo = await queryOne<ProgressPhoto>(
      `INSERT INTO progress_photos 
       (client_id, photo_url, photo_type, title, notes, thumbnail_url, tags, taken_at, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW()) 
       RETURNING *`,
      [
        userId,
        photo_url,
        photo_type || 'progress',
        title || null,
        notes || null,
        thumbnail_url || null,
        tags || null,
      ]
    );

    console.log(`✅ Progress photo added: ${photo?.id}`);

    res.status(201).json({
      success: true,
      data: { photo },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding progress photo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add progress photo',
    } as ApiResponse);
  }
});

// DELETE /client/progress-photos/:photoId - Delete a progress photo
router.delete('/progress-photos/:photoId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const photoId = req.params.photoId;

    console.log(`🗑️ Deleting progress photo ${photoId} for client: ${userId}`);

    // Get the photo first to return the URL for storage cleanup
    const existingPhoto = await queryOne<ProgressPhoto>(
      `SELECT * FROM progress_photos WHERE id = $1 AND client_id = $2`,
      [photoId, userId]
    );

    if (!existingPhoto) {
      res.status(404).json({
        success: false,
        error: 'Photo not found',
      } as ApiResponse);
      return;
    }

    // Delete the photo
    await query(
      `DELETE FROM progress_photos WHERE id = $1 AND client_id = $2`,
      [photoId, userId]
    );

    console.log(`✅ Progress photo deleted: ${photoId}`);

    res.status(200).json({
      success: true,
      message: 'Photo deleted successfully',
      data: { photo_url: existingPhoto.photo_url },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting progress photo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete progress photo',
    } as ApiResponse);
  }
});

// GET /client/progress-photos/:photoId/annotations - Get annotations for a photo
router.get('/progress-photos/:photoId/annotations', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const photoId = req.params.photoId;

    console.log(`📝 Fetching annotations for photo: ${photoId}`);

    // Verify photo belongs to client
    const photo = await queryOne<ProgressPhoto>(
      `SELECT id FROM progress_photos WHERE id = $1 AND client_id = $2`,
      [photoId, userId]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        error: 'Photo not found',
      } as ApiResponse);
      return;
    }

    // Fetch annotations with professional names
    const annotations = await query<PhotoAnnotation & { full_name: string | null }>(
      `SELECT pa.*, up.full_name 
       FROM photo_annotations pa
       LEFT JOIN user_profiles up ON pa.professional_id = up.id
       WHERE pa.photo_id = $1
       ORDER BY pa.created_at DESC`,
      [photoId]
    );

    const annotationsWithNames = annotations.map(ann => ({
      id: ann.id,
      photo_id: ann.photo_id,
      professional_id: ann.professional_id,
      markup_image: ann.markup_image,
      created_at: ann.created_at,
      updated_at: ann.updated_at,
      professional_name: ann.full_name || undefined,
    }));

    console.log(`✅ Found ${annotations.length} annotations`);

    res.status(200).json({
      success: true,
      data: { annotations: annotationsWithNames },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching annotations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch annotations',
    } as ApiResponse);
  }
});

// GET /client/progress-photos/:photoId/comments - Get comments for a photo
router.get('/progress-photos/:photoId/comments', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const photoId = req.params.photoId;

    console.log(`💬 Fetching comments for photo: ${photoId}`);

    // Verify photo belongs to client
    const photo = await queryOne<ProgressPhoto>(
      `SELECT id FROM progress_photos WHERE id = $1 AND client_id = $2`,
      [photoId, userId]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        error: 'Photo not found',
      } as ApiResponse);
      return;
    }

    // Fetch comments with professional names and avatars
    const comments = await query<PhotoComment & { full_name: string | null; avatar_url: string | null }>(
      `SELECT pc.*, up.full_name, up.avatar_url 
       FROM photo_comments pc
       LEFT JOIN user_profiles up ON pc.professional_id = up.id
       WHERE pc.photo_id = $1
       ORDER BY pc.created_at ASC`,
      [photoId]
    );

    const commentsWithNames = comments.map(comment => ({
      id: comment.id,
      photo_id: comment.photo_id,
      professional_id: comment.professional_id,
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      professional_name: comment.full_name || undefined,
      professional_avatar: comment.avatar_url || undefined,
    }));

    console.log(`✅ Found ${comments.length} comments`);

    res.status(200).json({
      success: true,
      data: { comments: commentsWithNames },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
    } as ApiResponse);
  }
});

// ============================================================================
// TREATMENT PLANS ROUTES
// ============================================================================

interface TreatmentPlan {
  id: string;
  client_id: string;
  professional_id: string;
  title: string;
  description: string | null;
  goals: string[] | null;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

interface TreatmentPlanMilestone {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  target_date: string;
  completed: boolean;
  completed_at: string | null;
  order_index: number;
}

interface TreatmentPlanProduct {
  id: string;
  plan_id: string;
  product_name: string;
  product_brand: string | null;
  product_category: string | null;
  usage_instructions: string | null;
  priority: string;
  created_at: string;
}

interface TreatmentPlanRoutine {
  id: string;
  plan_id: string;
  routine_name: string;
  routine_type: string | null;
  notes: string | null;
  created_at: string;
}

interface TreatmentPlanAppointment {
  id: string;
  plan_id: string;
  appointment_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_minutes: number;
  notes: string | null;
  completed: boolean;
  created_at: string;
}

interface ProfessionalInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// GET /client/treatment-plans - Get all treatment plans for the client
router.get('/treatment-plans', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📋 Fetching treatment plans for client: ${userId}`);

    // Fetch treatment plans for this client
    const plans = await query<TreatmentPlan>(
      `SELECT * FROM treatment_plans 
       WHERE client_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    if (plans.length === 0) {
      console.log('No treatment plans found');
      res.status(200).json({
        success: true,
        data: { plans: [], professionals: {} },
      } as ApiResponse);
      return;
    }

    const planIds = plans.map(p => p.id);

    // Fetch milestones
    const milestones = await query<TreatmentPlanMilestone>(
      `SELECT * FROM treatment_plan_milestones 
       WHERE plan_id = ANY($1) 
       ORDER BY order_index ASC`,
      [planIds]
    );

    // Fetch products
    const products = await query<TreatmentPlanProduct>(
      `SELECT * FROM treatment_plan_products 
       WHERE plan_id = ANY($1) 
       ORDER BY created_at ASC`,
      [planIds]
    );

    // Fetch routines
    const routines = await query<TreatmentPlanRoutine>(
      `SELECT * FROM treatment_plan_routines 
       WHERE plan_id = ANY($1) 
       ORDER BY created_at ASC`,
      [planIds]
    );

    // Fetch appointments
    const appointments = await query<TreatmentPlanAppointment>(
      `SELECT * FROM treatment_plan_appointments 
       WHERE plan_id = ANY($1) 
       ORDER BY scheduled_date ASC`,
      [planIds]
    );

    // Fetch professional info
    const professionalIds = [...new Set(plans.map(p => p.professional_id))];
    let professionals: Record<string, ProfessionalInfo> = {};
    
    if (professionalIds.length > 0) {
      const profData = await query<ProfessionalInfo>(
        `SELECT id, full_name, avatar_url FROM user_profiles WHERE id = ANY($1)`,
        [professionalIds]
      );
      
      profData.forEach(prof => {
        professionals[prof.id] = {
          id: prof.id,
          full_name: prof.full_name || 'Your Professional',
          avatar_url: prof.avatar_url,
        };
      });
    }

    // Group related data by plan_id
    const milestonesMap: Record<string, TreatmentPlanMilestone[]> = {};
    const productsMap: Record<string, TreatmentPlanProduct[]> = {};
    const routinesMap: Record<string, TreatmentPlanRoutine[]> = {};
    const appointmentsMap: Record<string, TreatmentPlanAppointment[]> = {};

    milestones.forEach(m => {
      if (!milestonesMap[m.plan_id]) milestonesMap[m.plan_id] = [];
      milestonesMap[m.plan_id].push(m);
    });

    products.forEach(p => {
      if (!productsMap[p.plan_id]) productsMap[p.plan_id] = [];
      productsMap[p.plan_id].push(p);
    });

    routines.forEach(r => {
      if (!routinesMap[r.plan_id]) routinesMap[r.plan_id] = [];
      routinesMap[r.plan_id].push(r);
    });

    appointments.forEach(a => {
      if (!appointmentsMap[a.plan_id]) appointmentsMap[a.plan_id] = [];
      appointmentsMap[a.plan_id].push(a);
    });

    // Build complete plans with related data
    const completePlans = plans.map(plan => ({
      ...plan,
      goals: plan.goals || [],
      milestones: milestonesMap[plan.id] || [],
      products: productsMap[plan.id] || [],
      routines: routinesMap[plan.id] || [],
      appointments: appointmentsMap[plan.id] || [],
    }));

    console.log(`✅ Found ${plans.length} treatment plans`);

    res.status(200).json({
      success: true,
      data: { plans: completePlans, professionals },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching treatment plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch treatment plans',
    } as ApiResponse);
  }
});

// PATCH /client/treatment-plans/milestones/:milestoneId - Toggle milestone completion
router.patch('/treatment-plans/milestones/:milestoneId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const milestoneId = req.params.milestoneId;
    const { completed } = req.body;

    console.log(`🎯 Toggling milestone ${milestoneId} completion to ${completed}`);

    // Verify the milestone belongs to a plan that belongs to this client
    const milestone = await queryOne<{ id: string; plan_id: string }>(
      `SELECT m.id, m.plan_id 
       FROM treatment_plan_milestones m
       JOIN treatment_plans p ON m.plan_id = p.id
       WHERE m.id = $1 AND p.client_id = $2`,
      [milestoneId, userId]
    );

    if (!milestone) {
      res.status(404).json({
        success: false,
        error: 'Milestone not found',
      } as ApiResponse);
      return;
    }

    const completedAt = completed ? new Date().toISOString() : null;

    // Update the milestone
    await query(
      `UPDATE treatment_plan_milestones 
       SET completed = $1, completed_at = $2 
       WHERE id = $3`,
      [completed, completedAt, milestoneId]
    );

    console.log(`✅ Milestone updated: ${milestoneId}`);

    res.status(200).json({
      success: true,
      data: { 
        milestone: {
          id: milestoneId,
          completed,
          completed_at: completedAt,
        }
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating milestone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update milestone',
    } as ApiResponse);
  }
});

// PATCH /client/treatment-plans/appointments/:appointmentId - Toggle appointment completion
router.patch('/treatment-plans/appointments/:appointmentId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const appointmentId = req.params.appointmentId;
    const { completed } = req.body;

    console.log(`📅 Toggling appointment ${appointmentId} completion to ${completed}`);

    // Verify the appointment belongs to a plan that belongs to this client
    const appointment = await queryOne<{ id: string; plan_id: string }>(
      `SELECT a.id, a.plan_id 
       FROM treatment_plan_appointments a
       JOIN treatment_plans p ON a.plan_id = p.id
       WHERE a.id = $1 AND p.client_id = $2`,
      [appointmentId, userId]
    );

    if (!appointment) {
      res.status(404).json({
        success: false,
        error: 'Appointment not found',
      } as ApiResponse);
      return;
    }

    // Update the appointment
    await query(
      `UPDATE treatment_plan_appointments 
       SET completed = $1 
       WHERE id = $2`,
      [completed, appointmentId]
    );

    console.log(`✅ Appointment updated: ${appointmentId}`);

    res.status(200).json({
      success: true,
      data: { 
        appointment: {
          id: appointmentId,
          completed,
        }
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment',
    } as ApiResponse);
  }
});

// ============================================================================
// ACHIEVEMENTS / GAMIFICATION ROUTES
// ============================================================================

interface UserGamification {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  total_routines_completed: number;
  level: string;
  last_completion_date: string | null;
  created_at: string;
  updated_at: string;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_name: string;
  badge_description: string | null;
  badge_icon: string | null;
  earned_at: string;
}

// GET /client/achievements - Get gamification stats and badges
router.get('/achievements', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`🏆 Fetching achievements for client: ${userId}`);

    // Fetch gamification data
    const gamification = await queryOne<UserGamification>(
      `SELECT * FROM user_gamification WHERE user_id = $1`,
      [userId]
    );

    // Fetch user badges
    const badges = await query<UserBadge>(
      `SELECT * FROM user_badges 
       WHERE user_id = $1 
       ORDER BY earned_at DESC`,
      [userId]
    );

    console.log(`✅ Found gamification data and ${badges.length} badges`);

    res.status(200).json({
      success: true,
      data: { 
        gamification: gamification || null,
        badges,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching achievements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch achievements',
    } as ApiResponse);
  }
});

// POST /client/achievements/badges - Save new badges (upsert)
router.post('/achievements/badges', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { badges } = req.body;

    if (!badges || !Array.isArray(badges) || badges.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Badges array is required',
      } as ApiResponse);
      return;
    }

    console.log(`🎖️ Saving ${badges.length} badges for client: ${userId}`);

    const savedBadges: UserBadge[] = [];

    for (const badge of badges) {
      if (!badge.name) continue;

      try {
        // Try to insert, ignore if already exists
        const existing = await queryOne<UserBadge>(
          `SELECT * FROM user_badges WHERE user_id = $1 AND badge_name = $2`,
          [userId, badge.name]
        );

        if (existing) {
          // Badge already exists, skip
          savedBadges.push(existing);
          continue;
        }

        // Insert new badge
        const newBadge = await queryOne<UserBadge>(
          `INSERT INTO user_badges (user_id, badge_name, badge_description, badge_icon, earned_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
          [userId, badge.name, badge.description || null, badge.image || null]
        );

        if (newBadge) {
          savedBadges.push(newBadge);
        }
      } catch (insertError) {
        // Handle duplicate key error gracefully
        console.log(`Badge ${badge.name} might already exist, skipping...`);
      }
    }

    console.log(`✅ Saved ${savedBadges.length} badges`);

    res.status(201).json({
      success: true,
      data: { badges: savedBadges },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error saving badges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save badges',
    } as ApiResponse);
  }
});

// ============================================================================
// LEADERBOARD ROUTES
// ============================================================================

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  points: number;
  level: string;
  streak: number;
  totalRoutines: number;
  isCurrentUser: boolean;
}

// GET /client/leaderboard - Get leaderboard data
router.get('/leaderboard', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`🏆 Fetching leaderboard for client: ${userId}`);

    // Fetch all gamification data with user profiles, ordered by points
    const leaderboardData = await query<{
      user_id: string;
      current_streak: number;
      longest_streak: number;
      points: number;
      total_routines_completed: number;
      level: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    }>(
      `SELECT 
        ug.user_id,
        ug.current_streak,
        ug.longest_streak,
        ug.points,
        ug.total_routines_completed,
        ug.level,
        up.full_name,
        up.email,
        up.avatar_url
       FROM user_gamification ug
       LEFT JOIN user_profiles up ON ug.user_id = up.id
       ORDER BY ug.points DESC`,
      []
    );

    // Build leaderboard entries
    let currentUserRank: number | null = null;
    const entries: LeaderboardEntry[] = leaderboardData.map((row, index) => {
      const isCurrentUser = userId === row.user_id;
      
      if (isCurrentUser) {
        currentUserRank = index + 1;
      }

      // Generate display name and avatar
      const displayName = row.full_name || row.email?.split('@')[0] || 'Anonymous';
      const avatarUrl = row.avatar_url || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=CFAFA3&color=2D2A3E&size=100`;

      return {
        rank: index + 1,
        userId: row.user_id,
        name: displayName,
        avatar: avatarUrl,
        points: row.points || 0,
        level: row.level || 'Bronze',
        streak: row.current_streak || 0,
        totalRoutines: row.total_routines_completed || 0,
        isCurrentUser,
      };
    });

    console.log(`✅ Found ${entries.length} leaderboard entries`);

    res.status(200).json({
      success: true,
      data: { 
        leaderboard: entries,
        currentUserRank,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
    } as ApiResponse);
  }
});

// ============================================================================
// SKIN ANALYSIS ROUTES
// ============================================================================

interface SkinAnalysisEntry {
  id: string;
  client_id: string;
  photo_url: string | null;
  age: number;
  gender: string;
  expression: string;
  hydration: string;
  elasticity: string;
  evenness: string;
  radiance: string;
  fine_wrinkles: string;
  eye_wrinkles: string;
  deep_wrinkles: string;
  dark_circle: string;
  eye_bag: string;
  pores: string;
  pigment: string;
  redness: string;
  oiliness: string;
  dryness: string;
  sagginess: string;
  fine_wrinkles_tips: string | null;
  eye_wrinkles_tips: string | null;
  deep_wrinkles_tips: string | null;
  dark_circle_tips: string | null;
  eye_bag_tips: string | null;
  pores_tips: string | null;
  pigment_tips: string | null;
  redness_tips: string | null;
  oiliness_tips: string | null;
  dryness_tips: string | null;
  sagginess_tips: string | null;
  created_at: string;
}

// GET /client/skin-analysis - Get skin analysis history
router.get('/skin-analysis', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`🔬 Fetching skin analysis history for client: ${userId}`);

    const analyses = await query<SkinAnalysisEntry>(
      `SELECT * FROM client_skin_analysis 
       WHERE client_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [userId]
    );

    console.log(`✅ Found ${analyses.length} skin analysis entries`);

    res.status(200).json({
      success: true,
      data: { analyses },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching skin analysis history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch skin analysis history',
    } as ApiResponse);
  }
});

// POST /client/skin-analysis - Save a new skin analysis
router.post('/skin-analysis', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const {
      photo_url,
      age,
      gender,
      expression,
      hydration,
      elasticity,
      evenness,
      radiance,
      fine_wrinkles,
      eye_wrinkles,
      deep_wrinkles,
      dark_circle,
      eye_bag,
      pores,
      pigment,
      redness,
      oiliness,
      dryness,
      sagginess,
      fine_wrinkles_tips,
      eye_wrinkles_tips,
      deep_wrinkles_tips,
      dark_circle_tips,
      eye_bag_tips,
      pores_tips,
      pigment_tips,
      redness_tips,
      oiliness_tips,
      dryness_tips,
      sagginess_tips,
    } = req.body;

    console.log(`🔬 Saving skin analysis for client: ${userId}`);

    const result = await queryOne<SkinAnalysisEntry>(
      `INSERT INTO client_skin_analysis (
        client_id, photo_url, age, gender, expression,
        hydration, elasticity, evenness, radiance,
        fine_wrinkles, eye_wrinkles, deep_wrinkles, dark_circle, eye_bag,
        pores, pigment, redness, oiliness, dryness, sagginess,
        fine_wrinkles_tips, eye_wrinkles_tips, deep_wrinkles_tips,
        dark_circle_tips, eye_bag_tips, pores_tips, pigment_tips,
        redness_tips, oiliness_tips, dryness_tips, sagginess_tips,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31,
        NOW()
      ) RETURNING *`,
      [
        userId, photo_url || null, age, gender, expression,
        hydration, elasticity, evenness, radiance,
        fine_wrinkles, eye_wrinkles, deep_wrinkles, dark_circle, eye_bag,
        pores, pigment, redness, oiliness, dryness, sagginess,
        fine_wrinkles_tips || null, eye_wrinkles_tips || null, deep_wrinkles_tips || null,
        dark_circle_tips || null, eye_bag_tips || null, pores_tips || null, pigment_tips || null,
        redness_tips || null, oiliness_tips || null, dryness_tips || null, sagginess_tips || null,
      ]
    );

    console.log(`✅ Skin analysis saved: ${result?.id}`);

    res.status(201).json({
      success: true,
      data: { analysis: result },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error saving skin analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save skin analysis',
    } as ApiResponse);
  }
});

// POST /client/skin-analysis/upload-photo - Upload skin analysis photo
router.post('/skin-analysis/upload-photo', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const { imageData } = req.body; // Base64 image data

    if (!imageData) {
      res.status(400).json({
        success: false,
        error: 'Image data is required',
      } as ApiResponse);
      return;
    }

    console.log(`📸 Uploading skin analysis photo for client: ${userId}`);

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const fileName = `enc_skin_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const uploadDir = path.join(__dirname, '../../uploads/photos');
    const filePath = path.join(uploadDir, fileName);

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, buffer);

    // Generate URL
    const photoUrl = `/uploads/photos/${fileName}`;

    console.log(`✅ Photo uploaded: ${photoUrl}`);

    res.status(201).json({
      success: true,
      data: { photo_url: photoUrl },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error uploading skin analysis photo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload photo',
    } as ApiResponse);
  }
});

// ============================================================================
// RECOMMENDED PRODUCTS ROUTES (From linked professionals)
// ============================================================================

interface RecommendedProduct {
  id: string;
  professional_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  ingredients: string | null;
  skin_types: string[] | null;
  concerns: string[] | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  purchase_url: string | null;
  is_active: boolean;
  is_global: boolean;
  usage_instructions: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * GET /client/recommended-products
 * Get products from professionals linked to this client
 * Fetches professional_ids from client_professional_relationships and then gets their products
 */
router.get('/recommended-products', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`🛍️ Fetching recommended products for client: ${userId}`);

    // Step 1: Get all professional_ids linked to this client
    const relationships = await query<{ professional_id: string }>(
      `SELECT professional_id 
       FROM client_professional_relationships 
       WHERE client_id = $1 AND status = 'active'`,
      [userId]
    );

    if (relationships.length === 0) {
      console.log(`ℹ️ No linked professionals found for client: ${userId}`);
      res.status(200).json({
        success: true,
        data: { products: [] },
      } as ApiResponse);
      return;
    }

    // Extract professional IDs as array
    const professionalIds = relationships.map(r => r.professional_id);

    console.log(`📋 Found ${professionalIds.length} linked professionals`);

    // Step 2: Get all active products from these professionals
    const products = await query<RecommendedProduct>(
      `SELECT 
        id, professional_id, name, brand, category, description, 
        ingredients, skin_types, concerns, price, currency, 
        image_url, purchase_url, is_active, is_global, 
        usage_instructions, created_at, updated_at
       FROM products 
       WHERE professional_id = ANY($1) 
         AND is_active = true
       ORDER BY created_at DESC`,
      [professionalIds]
    );

    console.log(`✅ Found ${products.length} recommended products`);

    res.status(200).json({
      success: true,
      data: { 
        products,
        professional_ids: professionalIds,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching recommended products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommended products',
    } as ApiResponse);
  }
});

// ============================================================================
// FACEAGE V2 SKIN ANALYSIS ROUTES
// ============================================================================

interface FaceAgeAnalysisEntry {
  id: string;
  user_id: string;
  original_area: string | null;
  skin_health: number | null;
  finewrinkles: number | null;
  eyewrinkles: number | null;
  deepwrinkles: number | null;
  darkcircle: number | null;
  eyebag: number | null;
  pores: number | null;
  pigment: number | null;
  redness: number | null;
  oiliness: number | null;
  acne: number | null;
  finewrinkles_area: string | null;
  eyewrinkles_area: string | null;
  deepwrinkles_area: string | null;
  darkcircle_area: string | null;
  eyebag_area: string | null;
  pores_area: string | null;
  pigment_area: string | null;
  redness_area: string | null;
  oiliness_area: string | null;
  acne_area: string | null;
  created_at: string;
}

// POST /client/faceage-analysis - Save FaceAge V2 skin analysis
router.post('/faceage-analysis', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;
    const {
      original_area,
      skin_health,
      finewrinkles,
      eyewrinkles,
      deepwrinkles,
      darkcircle,
      eyebag,
      pores,
      pigment,
      redness,
      oiliness,
      acne,
      finewrinkles_area,
      eyewrinkles_area,
      deepwrinkles_area,
      darkcircle_area,
      eyebag_area,
      pores_area,
      pigment_area,
      redness_area,
      oiliness_area,
      acne_area,
    } = req.body;

    console.log(`🔬 Saving FaceAge V2 analysis for user: ${userId}`);

    const result = await queryOne<FaceAgeAnalysisEntry>(
      `INSERT INTO skin_analysis (
        user_id, original_area, skin_health,
        finewrinkles, eyewrinkles, deepwrinkles, darkcircle, eyebag,
        pores, pigment, redness, oiliness, acne,
        finewrinkles_area, eyewrinkles_area, deepwrinkles_area, darkcircle_area, eyebag_area,
        pores_area, pigment_area, redness_area, oiliness_area, acne_area,
        created_at
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23,
        NOW()
      ) RETURNING *`,
      [
        userId, original_area || null, skin_health || null,
        finewrinkles || null, eyewrinkles || null, deepwrinkles || null, darkcircle || null, eyebag || null,
        pores || null, pigment || null, redness || null, oiliness || null, acne || null,
        finewrinkles_area || null, eyewrinkles_area || null, deepwrinkles_area || null, darkcircle_area || null, eyebag_area || null,
        pores_area || null, pigment_area || null, redness_area || null, oiliness_area || null, acne_area || null,
      ]
    );

    console.log(`✅ FaceAge V2 analysis saved: ${result?.id}`);

    res.status(201).json({
      success: true,
      data: { analysis: result },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error saving FaceAge V2 analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save skin analysis',
    } as ApiResponse);
  }
});

// GET /client/faceage-analysis/history - Get FaceAge V2 analysis history
router.get('/faceage-analysis/history', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`🔬 Fetching FaceAge V2 analysis history for user: ${userId}`);

    const analyses = await query<FaceAgeAnalysisEntry>(
      `SELECT * FROM skin_analysis
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    console.log(`✅ Found ${analyses.length} FaceAge V2 analyses`);

    res.status(200).json({
      success: true,
      data: { analyses },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching FaceAge V2 analysis history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis history',
    } as ApiResponse);
  }
});

export default router;
