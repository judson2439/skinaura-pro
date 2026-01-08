/**
 * Professional routes for managing clients, notifications, and professional-specific features.
 * Uses PostgreSQL for data storage.
 */

import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { verifyToken } from '../lib/auth.js';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface ClientProfessionalRelationship {
  id: string;
  client_id: string;
  professional_id: string;
  status: 'active' | 'pending' | 'inactive';
  created_at: string;
  updated_at: string;
}

interface RoutineNote {
  id: string;
  client_id: string;
  professional_id: string;
  note: string;
  sender_type: 'client' | 'professional' | null;
  read_status: boolean;
  professional_deleted: boolean;
  client_deleted: boolean;
  created_at: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
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
// CLIENT COUNT ENDPOINT
// ============================================================================

/**
 * GET /professional/clients/count
 * Get the count of active clients for a professional
 */
router.get('/clients/count', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📊 Fetching client count for professional: ${professionalId}`);

    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM client_professional_relationships 
       WHERE professional_id = $1 AND status = 'active'`,
      [professionalId]
    );

    const count = parseInt(result[0]?.count || '0', 10);

    console.log(`✅ Client count: ${count}`);

    res.status(200).json({
      success: true,
      data: { count },
    } as ApiResponse<{ count: number }>);

  } catch (error) {
    console.error('❌ Error fetching client count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client count',
    } as ApiResponse);
  }
});

// ============================================================================
// UNREAD NOTIFICATIONS COUNT ENDPOINT
// ============================================================================

/**
 * GET /professional/notifications/unread-count
 * Get the count of unread notifications (messages from clients)
 */
router.get('/notifications/unread-count', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📊 Fetching unread notifications for professional: ${professionalId}`);

    // Count unread notes from clients where professional_id matches
    // and sender_type is 'client' or null (messages from clients)
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM routine_notes 
       WHERE professional_id = $1 
         AND read_status = false 
         AND professional_deleted = false
         AND (sender_type = 'client' OR sender_type IS NULL)`,
      [professionalId]
    );

    const count = parseInt(result[0]?.count || '0', 10);

    console.log(`✅ Unread notifications count: ${count}`);

    res.status(200).json({
      success: true,
      data: { count },
    } as ApiResponse<{ count: number }>);

  } catch (error) {
    console.error('❌ Error fetching unread notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread notifications count',
    } as ApiResponse);
  }
});

// ============================================================================
// GET ALL NOTIFICATIONS
// ============================================================================

/**
 * GET /professional/notifications
 * Get all notifications for a professional
 */
router.get('/notifications', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    console.log(`📊 Fetching notifications for professional: ${professionalId}`);

    const notifications = await query<RoutineNote>(
      `SELECT rn.*, up.full_name as client_name, up.avatar_url as client_avatar
       FROM routine_notes rn
       LEFT JOIN user_profiles up ON rn.client_id = up.id
       WHERE rn.professional_id = $1 
         AND rn.professional_deleted = false
         AND (rn.sender_type = 'client' OR rn.sender_type IS NULL)
       ORDER BY rn.created_at DESC
       LIMIT $2 OFFSET $3`,
      [professionalId, limit, offset]
    );

    console.log(`✅ Found ${notifications.length} notifications`);

    res.status(200).json({
      success: true,
      data: { notifications },
    } as ApiResponse<{ notifications: RoutineNote[] }>);

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    } as ApiResponse);
  }
});

// ============================================================================
// MARK NOTIFICATION AS READ
// ============================================================================

/**
 * PATCH /professional/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/notifications/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const notificationId = req.params.id;

    console.log(`📝 Marking notification ${notificationId} as read`);

    await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE id = $1 AND professional_id = $2`,
      [notificationId, professionalId]
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

// ============================================================================
// MARK ALL NOTIFICATIONS AS READ
// ============================================================================

/**
 * PATCH /professional/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/notifications/read-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📝 Marking all notifications as read for professional: ${professionalId}`);

    const result = await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE professional_id = $1 
         AND read_status = false
         AND professional_deleted = false
         AND (sender_type = 'client' OR sender_type IS NULL)`,
      [professionalId]
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
// DELETE NOTIFICATION
// ============================================================================

/**
 * DELETE /professional/notifications/:id
 * Soft delete a notification (mark as deleted for professional)
 */
router.delete('/notifications/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const notificationId = req.params.id;

    console.log(`🗑️ Deleting notification ${notificationId}`);

    await query(
      `UPDATE routine_notes 
       SET professional_deleted = true 
       WHERE id = $1 AND professional_id = $2`,
      [notificationId, professionalId]
    );

    console.log(`✅ Notification deleted`);

    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
    } as ApiResponse);
  }
});

// ============================================================================
// GET CLIENTS LIST
// ============================================================================

/**
 * GET /professional/clients
 * Get all clients for a professional
 */
router.get('/clients', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const status = req.query.status as string || 'active';

    console.log(`📊 Fetching clients for professional: ${professionalId}`);

    const clients = await query<{
      id: string;
      email: string;
      full_name: string;
      avatar_url: string | null;
      phone: string | null;
      skin_type: string | null;
      concerns: string[] | null;
      relationship_status: string;
      relationship_created_at: string;
    }>(
      `SELECT 
        up.id,
        up.email,
        up.full_name,
        up.avatar_url,
        up.phone,
        up.skin_type,
        up.concerns,
        cpr.status as relationship_status,
        cpr.created_at as relationship_created_at
       FROM client_professional_relationships cpr
       JOIN user_profiles up ON cpr.client_id = up.id
       WHERE cpr.professional_id = $1 AND cpr.status = $2
       ORDER BY up.full_name ASC`,
      [professionalId, status]
    );

    console.log(`✅ Found ${clients.length} clients`);

    res.status(200).json({
      success: true,
      data: { clients },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
    } as ApiResponse);
  }
});

// ============================================================================
// GET CLIENT GAMIFICATION DATA
// ============================================================================

/**
 * GET /professional/clients/:clientId/gamification
 * Get gamification data for a specific client
 */
router.get('/clients/:clientId/gamification', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;

    console.log(`📊 Fetching gamification data for client: ${clientId}`);

    // First verify this client belongs to this professional
    const relationship = await queryOne<ClientProfessionalRelationship>(
      `SELECT * FROM client_professional_relationships 
       WHERE professional_id = $1 AND client_id = $2 AND status = 'active'`,
      [professionalId, clientId]
    );

    if (!relationship) {
      res.status(404).json({
        success: false,
        error: 'Client not found or not associated with this professional',
      } as ApiResponse);
      return;
    }

    // Fetch gamification data
    const gamification = await queryOne<{
      user_id: string;
      points: number;
      level: string;
      current_streak: number;
      longest_streak: number;
      total_routines_completed: number;
      badges_earned: number;
      last_activity_date: string | null;
    }>(
      `SELECT * FROM user_gamification WHERE user_id = $1`,
      [clientId]
    );

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

// ============================================================================
// DASHBOARD DATA ENDPOINT
// ============================================================================

interface DashboardClient {
  id: string;
  name: string;
  email: string;
  image: string;
  phone?: string;
  skinType?: string;
  concerns?: string[];
  currentStreak: number;
  level: string;
  compliance: number;
  routineCompletedToday: boolean;
  isRegistered: boolean;
}

interface UserGamification {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  points: number;
  total_routines_completed: number;
  level: string;
  last_completion_date: string | null;
}

interface RoutineCompletion {
  client_id: string;
  completion_date: string;
  routine_type: string;
}

// Calculate level based on points
const calculateLevel = (points: number): string => {
  if (points >= 5000) return 'Diamond';
  if (points >= 3000) return 'Platinum';
  if (points >= 1500) return 'Gold';
  if (points >= 500) return 'Silver';
  return 'Bronze';
};

// Calculate compliance percentage
const calculateCompliance = (
  completions: RoutineCompletion[],
  clientId: string,
  daysToCheck: number = 30
): number => {
  const clientCompletions = completions.filter(c => c.client_id === clientId);
  const uniqueDates = new Set(clientCompletions.map(c => c.completion_date));
  const compliance = Math.round((uniqueDates.size / daysToCheck) * 100);
  return Math.min(compliance, 100);
};

// Check if routine was completed today
const checkCompletedToday = (
  completions: RoutineCompletion[],
  clientId: string
): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return completions.some(c => c.client_id === clientId && c.completion_date === today);
};

/**
 * GET /professional/dashboard
 * Get all dashboard data for a professional (clients, gamification, completions)
 */
router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📊 Fetching dashboard data for professional: ${professionalId}`);

    // Step 1: Get all client_ids from client_professional_relationships
    const relationships = await query<{ client_id: string }>(
      `SELECT client_id FROM client_professional_relationships 
       WHERE professional_id = $1 AND status = 'active'`,
      [professionalId]
    );

    const clientIds = relationships.map(r => r.client_id);

    if (clientIds.length === 0) {
      console.log(`✅ No clients found for professional`);
      res.status(200).json({
        success: true,
        data: { clients: [], stats: { totalClients: 0, completedToday: 0, needAttention: 0, avgCompliance: 0 } },
      } as ApiResponse);
      return;
    }

    // Step 2: Get client profiles from user_profiles
    const profiles = await query<{
      id: string;
      email: string;
      full_name: string | null;
      avatar_url: string | null;
      phone: string | null;
      skin_type: string | null;
      concerns: string[] | null;
    }>(
      `SELECT id, email, full_name, avatar_url, phone, skin_type, concerns
       FROM user_profiles
       WHERE id = ANY($1)`,
      [clientIds]
    );

    // Step 3: Get gamification data for all clients
    const gamificationData = await query<UserGamification>(
      `SELECT user_id, current_streak, longest_streak, points, total_routines_completed, level, last_completion_date
       FROM user_gamification
       WHERE user_id = ANY($1)`,
      [clientIds]
    );

    // Step 4: Get routine completions for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const completionsData = await query<RoutineCompletion>(
      `SELECT client_id, completion_date, routine_type
       FROM routine_completions
       WHERE client_id = ANY($1) AND completion_date >= $2`,
      [clientIds, thirtyDaysAgoStr]
    );

    // Create lookup maps
    const gamificationMap = new Map<string, UserGamification>();
    gamificationData.forEach((g) => {
      gamificationMap.set(g.user_id, g);
    });

    // Step 5: Build client objects
    const clients: DashboardClient[] = profiles.map((profile) => {
      const gamification = gamificationMap.get(profile.id);
      const compliance = calculateCompliance(completionsData, profile.id);
      const completedToday = checkCompletedToday(completionsData, profile.id);

      const displayName = profile.full_name || profile.email?.split('@')[0] || 'Unknown';
      const avatarUrl = profile.avatar_url || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=CFAFA3&color=fff&size=100`;

      return {
        id: profile.id,
        name: displayName,
        email: profile.email || '',
        image: avatarUrl,
        phone: profile.phone || undefined,
        skinType: profile.skin_type || undefined,
        concerns: profile.concerns || undefined,
        currentStreak: gamification?.current_streak || 0,
        level: gamification?.level || calculateLevel(gamification?.points || 0),
        compliance: compliance,
        routineCompletedToday: completedToday,
        isRegistered: true,
      };
    });

    // Calculate stats
    const totalClients = clients.length;
    const completedToday = clients.filter(c => c.routineCompletedToday).length;
    const needAttention = clients.filter(c => !c.routineCompletedToday || c.compliance < 70).length;
    const avgCompliance = totalClients > 0
      ? Math.round(clients.reduce((sum, c) => sum + c.compliance, 0) / totalClients)
      : 0;

    console.log(`✅ Dashboard data fetched: ${clients.length} clients`);

    res.status(200).json({
      success: true,
      data: {
        clients,
        stats: {
          totalClients,
          completedToday,
          needAttention,
          avgCompliance,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    } as ApiResponse);
  }
});

// ============================================================================
// SMS REMINDER ENDPOINT
// ============================================================================

/**
 * POST /professional/sms/send
 * Send an SMS reminder to a client
 */
router.post('/sms/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { clientId, phone, message, clientName } = req.body;

    if (!phone || !message) {
      res.status(400).json({
        success: false,
        error: 'Phone number and message are required',
      } as ApiResponse);
      return;
    }

    console.log(`📱 Sending SMS reminder to ${phone}`);

    // Get professional's name
    const professional = await queryOne<{ full_name: string }>(
      `SELECT full_name FROM user_profiles WHERE id = $1`,
      [professionalId]
    );

    const professionalName = professional?.full_name || 'Your Skincare Professional';

    // Format the phone number
    let formattedPhone = phone.replace(/[^\d+]/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+1' + formattedPhone;
    }

    // Build the full message with greeting
    const fullMessage = `Hi ${clientName || 'there'}! ${message}\n\n- ${professionalName}`;

    // Import and use Twilio
    const twilio = await import('twilio');
    const twilioClient = twilio.default(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const twilioResponse = await twilioClient.messages.create({
      body: fullMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ SMS sent successfully: ${twilioResponse.sid}`);

    res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      data: { messageSid: twilioResponse.sid },
    } as ApiResponse);

  } catch (error: any) {
    console.error('❌ Error sending SMS:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send SMS',
    } as ApiResponse);
  }
});

export default router;
