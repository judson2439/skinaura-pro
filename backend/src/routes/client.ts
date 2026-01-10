/**
 * Client routes for managing routines, gamification, and completions.
 * Uses PostgreSQL for data storage.
 */

import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { verifyToken } from '../lib/auth.js';

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
  badges_earned: number;
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
        total_routines_completed, badges_earned, created_at, updated_at
      ) VALUES ($1, 0, 'Bronze', 0, 0, 0, 0, NOW(), NOW())
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

export default router;
