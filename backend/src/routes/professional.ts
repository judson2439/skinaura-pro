/**
 * Professional routes for managing clients, notifications, and professional-specific features.
 * Uses PostgreSQL for data storage.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne } from '../config/database.js';
import { verifyToken } from '../lib/auth.js';
import { logAuditFromRequest } from '../lib/auditLogger.js';
import { env } from '../config/env.js';

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

    // Audit log: Professional accessing client list
    await logAuditFromRequest(req, 'VIEW_LIST', 'user_profile', undefined, {
      accessed_by: 'professional',
      count: clients.length,
      filter_status: status,
    });

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
  const dateCount = clientCompletions.reduce((acc: Record<string, number>, item: { completion_date: string }) => {
    const date = new Date(item.completion_date).toISOString().slice(0, 10); // Normalize to YYYY-MM-DD
    (acc as Record<string, number>)[date] = ((acc as Record<string, number>)[date] || 0) + 1;
    return acc;
  }, {});
  
  // Total removed duplicates
  const removedCount = Object.values(dateCount).reduce((sum: number, count: number): number => {
    return sum + (count - 1); // Remove the first occurrence, keep the rest as duplicates
  }, 0);
  const compliance = Math.round(((clientCompletions.length - removedCount) / 30) * 100);
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

// ============================================================================
// GET NOTIFICATIONS GROUPED BY CLIENT
// ============================================================================

/**
 * GET /professional/notifications/grouped
 * Get all notifications grouped by client for the notifications section
 */
router.get('/notifications/grouped', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📊 Fetching grouped notifications for professional: ${professionalId}`);

    // Get all notes for this professional, grouped by client
    const notes = await query<{
      id: string;
      client_id: string;
      content: string;
      sender_type: string;
      read_status: boolean;
      created_at: string;
    }>(
      `SELECT id, client_id, content, sender_type, read_status, created_at
       FROM routine_notes
       WHERE professional_id = $1
         AND professional_deleted = false
       ORDER BY created_at DESC`,
      [professionalId]
    );

    if (!notes || notes.length === 0) {
      res.status(200).json({
        success: true,
        data: { groups: [] },
      } as ApiResponse);
      return;
    }

    // Get unique client IDs
    const clientIds = [...new Set(notes.map(note => note.client_id))];

    // Fetch client profiles
    const clientProfiles = await query<{
      id: string;
      full_name: string;
      avatar_url: string | null;
    }>(
      `SELECT id, full_name, avatar_url
       FROM user_profiles
       WHERE id = ANY($1)`,
      [clientIds]
    );

    // Group notes by client
    const groupedByClient: { [clientId: string]: typeof notes } = {};
    notes.forEach(note => {
      if (!groupedByClient[note.client_id]) {
        groupedByClient[note.client_id] = [];
      }
      groupedByClient[note.client_id].push(note);
    });

    // Create client groups with stats
    const groups = Object.entries(groupedByClient).map(([clientId, clientNotes]) => {
      const clientProfile = clientProfiles?.find(p => p.id === clientId);
      const unreadCount = clientNotes.filter(
        n => !n.read_status && (n.sender_type === 'client' || !n.sender_type)
      ).length;
      const lastNote = clientNotes[0]; // Already sorted by created_at desc

      return {
        client_id: clientId,
        client_name: clientProfile?.full_name || 'Unknown Client',
        client_avatar: clientProfile?.avatar_url || null,
        unread_count: unreadCount,
        total_count: clientNotes.length,
        last_message: lastNote.content,
        last_message_time: lastNote.created_at,
        last_sender_type: lastNote.sender_type || 'client',
      };
    });

    // Sort by unread count (desc) then by last message time (desc)
    groups.sort((a, b) => {
      if (b.unread_count !== a.unread_count) {
        return b.unread_count - a.unread_count;
      }
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });

    console.log(`✅ Found ${groups.length} client groups`);

    res.status(200).json({
      success: true,
      data: { groups },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching grouped notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    } as ApiResponse);
  }
});

// ============================================================================
// GET CHAT MESSAGES WITH A CLIENT
// ============================================================================

/**
 * GET /professional/chat/:clientId
 * Get all chat messages with a specific client
 */
router.get('/chat/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;

    console.log(`💬 Fetching chat messages between professional ${professionalId} and client ${clientId}`);

    const messages = await query<{
      id: string;
      client_id: string;
      professional_id: string;
      content: string;
      sender_type: string;
      read_status: boolean;
      created_at: string;
    }>(
      `SELECT id, client_id, professional_id, content, sender_type, read_status, created_at
       FROM routine_notes
       WHERE client_id = $1
         AND professional_id = $2
         AND professional_deleted = false
       ORDER BY created_at ASC`,
      [clientId, professionalId]
    );

    console.log(`✅ Found ${messages.length} messages`);

    res.status(200).json({
      success: true,
      data: { messages },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat messages',
    } as ApiResponse);
  }
});

// ============================================================================
// SEND MESSAGE TO CLIENT
// ============================================================================

/**
 * POST /professional/chat/:clientId
 * Send a message to a client
 */
router.post('/chat/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({
        success: false,
        error: 'Message content is required',
      } as ApiResponse);
      return;
    }

    console.log(`📤 Sending message from professional ${professionalId} to client ${clientId}`);

    const message = await queryOne<{
      id: string;
      client_id: string;
      professional_id: string;
      content: string;
      sender_type: string;
      read_status: boolean;
      created_at: string;
    }>(
      `INSERT INTO routine_notes (client_id, professional_id, content, sender_type, read_status, client_deleted, professional_deleted)
       VALUES ($1, $2, $3, 'professional', false, false, false)
       RETURNING id, client_id, professional_id, content, sender_type, read_status, created_at`,
      [clientId, professionalId, content.trim()]
    );

    console.log(`✅ Message sent: ${message?.id}`);

    res.status(201).json({
      success: true,
      data: { message },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
    } as ApiResponse);
  }
});

// ============================================================================
// MARK CLIENT MESSAGES AS READ
// ============================================================================

/**
 * PATCH /professional/chat/:clientId/mark-read
 * Mark all messages from a specific client as read
 */
router.patch('/chat/:clientId/mark-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;

    console.log(`✅ Marking messages from client ${clientId} as read`);

    await query(
      `UPDATE routine_notes
       SET read_status = true
       WHERE client_id = $1
         AND professional_id = $2
         AND sender_type = 'client'
         AND read_status = false`,
      [clientId, professionalId]
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

// ============================================================================
// CLIENT PHOTOS ENDPOINTS
// ============================================================================

interface ProgressPhoto {
  id: string;
  client_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  notes: string | null;
  skin_analysis: Record<string, unknown> | null;
  tags: string[] | null;
  taken_at: string | null;
  created_at: string;
  updated_at: string;
  photo_type: string | null;
  title: string | null;
}

interface PhotoComment {
  id: string;
  photo_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  professional_name?: string;
}

interface PhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  markup_image: string;
  created_at: string;
  updated_at: string;
  professional_name?: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

/**
 * GET /professional/client-photos
 * Get all progress photos from clients linked to this professional
 */
router.get('/client-photos', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📸 Fetching client photos for professional: ${professionalId}`);

    // Step 1: Get all client IDs from relationships
    const relationships = await query<{ client_id: string }>(
      `SELECT DISTINCT client_id FROM client_professional_relationships WHERE professional_id = $1`,
      [professionalId]
    );

    const clientIds = relationships.map(r => r.client_id);

    if (clientIds.length === 0) {
      console.log('No clients found for professional');
      res.status(200).json({
        success: true,
        data: { photos: [], clients: [] },
      } as ApiResponse);
      return;
    }

    // Step 2: Get client profiles
    const clients = await query<UserProfile>(
      `SELECT id, email, full_name, avatar_url, role FROM user_profiles WHERE id = ANY($1)`,
      [clientIds]
    );

    // Step 3: Get progress photos for all clients
    const photos = await query<ProgressPhoto>(
      `SELECT * FROM progress_photos 
       WHERE client_id = ANY($1) 
       ORDER BY created_at DESC`,
      [clientIds]
    );

    console.log(`✅ Found ${photos.length} photos from ${clients.length} clients`);

    res.status(200).json({
      success: true,
      data: { photos, clients },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching client photos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client photos',
    } as ApiResponse);
  }
});

/**
 * GET /professional/photos/:photoId/comments
 * Get all comments for a photo
 */
router.get('/photos/:photoId/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const photoId = req.params.photoId;

    console.log(`💬 Fetching comments for photo: ${photoId}`);

    // Verify the photo belongs to one of the professional's clients
    const photo = await queryOne<{ client_id: string }>(
      `SELECT p.client_id FROM progress_photos p
       JOIN client_professional_relationships cpr ON p.client_id = cpr.client_id
       WHERE p.id = $1 AND cpr.professional_id = $2`,
      [photoId, professionalId]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        error: 'Photo not found or access denied',
      } as ApiResponse);
      return;
    }

    // Get comments with professional names
    const comments = await query<PhotoComment & { full_name: string | null }>(
      `SELECT pc.*, up.full_name 
       FROM photo_comments pc
       LEFT JOIN user_profiles up ON pc.professional_id = up.id
       WHERE pc.photo_id = $1
       ORDER BY pc.created_at ASC`,
      [photoId]
    );

    const commentsWithNames = comments.map(c => ({
      id: c.id,
      photo_id: c.photo_id,
      professional_id: c.professional_id,
      content: c.content,
      created_at: c.created_at,
      updated_at: c.updated_at,
      professional_name: c.professional_id === professionalId ? 'You' : (c.full_name || 'Professional'),
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

/**
 * GET /professional/photos/:photoId/annotations
 * Get all annotations for a photo
 */
router.get('/photos/:photoId/annotations', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const photoId = req.params.photoId;

    console.log(`📝 Fetching annotations for photo: ${photoId}`);

    // Verify the photo belongs to one of the professional's clients
    const photo = await queryOne<{ client_id: string }>(
      `SELECT p.client_id FROM progress_photos p
       JOIN client_professional_relationships cpr ON p.client_id = cpr.client_id
       WHERE p.id = $1 AND cpr.professional_id = $2`,
      [photoId, professionalId]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        error: 'Photo not found or access denied',
      } as ApiResponse);
      return;
    }

    // Get annotations with professional names
    const annotations = await query<PhotoAnnotation & { full_name: string | null }>(
      `SELECT pa.*, up.full_name 
       FROM photo_annotations pa
       LEFT JOIN user_profiles up ON pa.professional_id = up.id
       WHERE pa.photo_id = $1
       ORDER BY pa.created_at DESC`,
      [photoId]
    );

    const annotationsWithNames = annotations.map(a => ({
      id: a.id,
      photo_id: a.photo_id,
      professional_id: a.professional_id,
      markup_image: a.markup_image,
      created_at: a.created_at,
      updated_at: a.updated_at,
      professional_name: a.professional_id === professionalId ? 'You' : (a.full_name || 'Professional'),
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

/**
 * POST /professional/photos/:photoId/comments
 * Add a comment to a photo
 */
router.post('/photos/:photoId/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const photoId = req.params.photoId;
    const { content } = req.body;

    if (!content?.trim()) {
      res.status(400).json({
        success: false,
        error: 'Comment content is required',
      } as ApiResponse);
      return;
    }

    console.log(`💬 Adding comment to photo: ${photoId}`);

    // Verify the photo belongs to one of the professional's clients
    const photo = await queryOne<{ client_id: string }>(
      `SELECT p.client_id FROM progress_photos p
       JOIN client_professional_relationships cpr ON p.client_id = cpr.client_id
       WHERE p.id = $1 AND cpr.professional_id = $2`,
      [photoId, professionalId]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        error: 'Photo not found or access denied',
      } as ApiResponse);
      return;
    }

    // Insert comment
    const comment = await queryOne<PhotoComment>(
      `INSERT INTO photo_comments (photo_id, professional_id, content, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [photoId, professionalId, content.trim()]
    );

    console.log(`✅ Comment added: ${comment?.id}`);

    res.status(201).json({
      success: true,
      data: { 
        comment: {
          ...comment,
          professional_name: 'You',
        }
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
    } as ApiResponse);
  }
});

/**
 * DELETE /professional/photos/:photoId/comments/:commentId
 * Delete a comment
 */
router.delete('/photos/:photoId/comments/:commentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { photoId, commentId } = req.params;

    console.log(`🗑️ Deleting comment: ${commentId}`);

    // Delete comment (only if it belongs to this professional)
    const result = await query(
      `DELETE FROM photo_comments 
       WHERE id = $1 AND photo_id = $2 AND professional_id = $3
       RETURNING id`,
      [commentId, photoId, professionalId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Comment not found or access denied',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Comment deleted: ${commentId}`);

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment',
    } as ApiResponse);
  }
});

/**
 * POST /professional/photos/:photoId/annotations
 * Save an annotation (markup) for a photo
 */
router.post('/photos/:photoId/annotations', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const photoId = req.params.photoId;
    const { markup_image } = req.body;

    if (!markup_image) {
      res.status(400).json({
        success: false,
        error: 'Markup image URL is required',
      } as ApiResponse);
      return;
    }

    console.log(`📝 Adding annotation to photo: ${photoId}`);

    // Verify the photo belongs to one of the professional's clients
    const photo = await queryOne<{ client_id: string }>(
      `SELECT p.client_id FROM progress_photos p
       JOIN client_professional_relationships cpr ON p.client_id = cpr.client_id
       WHERE p.id = $1 AND cpr.professional_id = $2`,
      [photoId, professionalId]
    );

    if (!photo) {
      res.status(404).json({
        success: false,
        error: 'Photo not found or access denied',
      } as ApiResponse);
      return;
    }

    // Insert annotation
    const annotation = await queryOne<PhotoAnnotation>(
      `INSERT INTO photo_annotations (photo_id, professional_id, markup_image, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [photoId, professionalId, markup_image]
    );

    console.log(`✅ Annotation added: ${annotation?.id}`);

    res.status(201).json({
      success: true,
      data: { 
        annotation: {
          ...annotation,
          professional_name: 'You',
        }
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding annotation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add annotation',
    } as ApiResponse);
  }
});

/**
 * DELETE /professional/photos/:photoId/annotations/:annotationId
 * Delete an annotation
 */
router.delete('/photos/:photoId/annotations/:annotationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { photoId, annotationId } = req.params;

    console.log(`🗑️ Deleting annotation: ${annotationId}`);

    // Get annotation to return markup_image URL for cleanup
    const annotation = await queryOne<{ markup_image: string }>(
      `DELETE FROM photo_annotations 
       WHERE id = $1 AND photo_id = $2 AND professional_id = $3
       RETURNING markup_image`,
      [annotationId, photoId, professionalId]
    );

    if (!annotation) {
      res.status(404).json({
        success: false,
        error: 'Annotation not found or access denied',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Annotation deleted: ${annotationId}`);

    res.status(200).json({
      success: true,
      message: 'Annotation deleted successfully',
      data: { markup_image: annotation.markup_image },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting annotation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete annotation',
    } as ApiResponse);
  }
});

// ============================================================================
// CLIENT PROFILE ENDPOINTS (for ClientProfileModal)
// ============================================================================

interface ClientNote {
  id: string;
  client_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

interface ClientProduct {
  id: string;
  client_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  notes: string | null;
  added_via: string | null;
  days_used: number | null;
  created_at: string;
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
}

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

interface AssignedRoutineStep {
  id: string;
  routine_id: string;
  step_order: number;
  step_name: string;
  product_category: string | null;
  description: string | null;
}

interface AssignedRoutine {
  id: string;
  routine_id: string;
  client_id: string;
  assigned_at: string;
  notes: string | null;
  is_active: boolean;
}

/**
 * GET /professional/clients/:clientId/profile
 * Get complete client profile data for ClientProfileModal
 */
router.get('/clients/:clientId/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;

    console.log(`👤 Fetching profile for client: ${clientId}`);

    // Verify client belongs to professional
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

    // Fetch all data in parallel
    const [
      gamificationResult,
      completionsResult,
      treatmentPlansResult,
      assignmentsResult,
      productsResult,
      photosResult,
      notesResult,
    ] = await Promise.all([
      // Gamification
      queryOne<{
        user_id: string;
        current_streak: number;
        longest_streak: number;
        points: number;
        level: string;
        total_routines_completed: number;
      }>(`SELECT * FROM user_gamification WHERE user_id = $1`, [clientId]),

      // Routine completions (last 30 days)
      query<{ completion_date: string }>(
        `SELECT completion_date FROM routine_completions 
         WHERE client_id = $1 AND completion_date >= NOW() - INTERVAL '30 days'`,
        [clientId]
      ),

      // Treatment plans
      query<TreatmentPlan>(
        `SELECT * FROM treatment_plans WHERE client_id = $1 ORDER BY created_at DESC`,
        [clientId]
      ),

      // Routine assignments
      query<AssignedRoutine>(
        `SELECT * FROM client_routine_assignments WHERE client_id = $1 AND is_active = true`,
        [clientId]
      ),

      // Client products
      query<ClientProduct>(
        `SELECT * FROM client_products WHERE client_id = $1 ORDER BY created_at DESC`,
        [clientId]
      ),

      // Progress photos
      query<ProgressPhoto>(
        `SELECT * FROM progress_photos WHERE client_id = $1 ORDER BY taken_at DESC`,
        [clientId]
      ),

      // Client notes
      query<ClientNote>(
        `SELECT * FROM client_notes WHERE client_id = $1 ORDER BY created_at DESC`,
        [clientId]
      ),
    ]);

    // Calculate compliance rate
    const dateCount = completionsResult.reduce((acc: Record<string, number>, item: { completion_date: string }) => {
      const date = new Date(item.completion_date).toISOString().slice(0, 10); // Normalize to YYYY-MM-DD
      (acc as Record<string, number>)[date] = ((acc as Record<string, number>)[date] || 0) + 1;
      return acc;
    }, {});
    
    // Total removed duplicates
    const removedCount = Object.values(dateCount).reduce((sum: number, count: number): number => {
      return sum + (count - 1); // Remove the first occurrence, keep the rest as duplicates
    }, 0);
    const complianceRate = Math.round(((completionsResult.length - removedCount) / 30) * 100);

    // Build gamification stats
    const stats = {
      current_streak: gamificationResult?.current_streak || 0,
      longest_streak: gamificationResult?.longest_streak || 0,
      points: gamificationResult?.points || 0,
      level: gamificationResult?.level || 'Bronze',
      total_routines_completed: gamificationResult?.total_routines_completed || 0,
      compliance_rate: complianceRate,
    };

    // Fetch treatment plan details (milestones, products) if plans exist
    let treatmentPlans: Array<TreatmentPlan & { milestones: TreatmentPlanMilestone[]; products: TreatmentPlanProduct[] }> = [];
    
    if (treatmentPlansResult.length > 0) {
      const planIds = treatmentPlansResult.map(p => p.id);

      const [milestonesResult, planProductsResult] = await Promise.all([
        query<TreatmentPlanMilestone>(
          `SELECT * FROM treatment_plan_milestones WHERE plan_id = ANY($1) ORDER BY order_index`,
          [planIds]
        ),
        query<TreatmentPlanProduct>(
          `SELECT * FROM treatment_plan_products WHERE plan_id = ANY($1)`,
          [planIds]
        ),
      ]);

      const milestonesMap: Record<string, TreatmentPlanMilestone[]> = {};
      const productsMap: Record<string, TreatmentPlanProduct[]> = {};

      milestonesResult.forEach(m => {
        if (!milestonesMap[m.plan_id]) milestonesMap[m.plan_id] = [];
        milestonesMap[m.plan_id].push(m);
      });

      planProductsResult.forEach(p => {
        if (!productsMap[p.plan_id]) productsMap[p.plan_id] = [];
        productsMap[p.plan_id].push(p);
      });

      treatmentPlans = treatmentPlansResult.map(plan => ({
        ...plan,
        goals: plan.goals || [],
        milestones: milestonesMap[plan.id] || [],
        products: productsMap[plan.id] || [],
      }));
    }

    // Fetch routine details if assignments exist
    let assignedRoutines: Array<{
      id: string;
      routine_id: string;
      routine_name: string;
      schedule_type: string;
      assigned_at: string;
      is_active: boolean;
      steps: AssignedRoutineStep[];
      professional_notes: string | null;
    }> = [];

    if (assignmentsResult.length > 0) {
      const routineIds = assignmentsResult.map(a => a.routine_id);

      const [routinesResult, stepsResult] = await Promise.all([
        query<{ id: string; name: string; schedule_type: string }>(
          `SELECT id, name, schedule_type FROM routine_templates WHERE id = ANY($1)`,
          [routineIds]
        ),
        query<AssignedRoutineStep>(
          `SELECT * FROM routine_steps WHERE routine_id = ANY($1) ORDER BY step_order`,
          [routineIds]
        ),
      ]);

      const stepsMap: Record<string, AssignedRoutineStep[]> = {};
      stepsResult.forEach(s => {
        if (!stepsMap[s.routine_id]) stepsMap[s.routine_id] = [];
        stepsMap[s.routine_id].push(s);
      });

      assignedRoutines = assignmentsResult.map(a => {
        const routine = routinesResult.find(r => r.id === a.routine_id);
        return {
          id: a.id,
          routine_id: a.routine_id,
          routine_name: routine?.name || 'Unknown Routine',
          schedule_type: routine?.schedule_type || 'daily',
          assigned_at: a.assigned_at,
          is_active: a.is_active,
          steps: stepsMap[a.routine_id] || [],
          professional_notes: a.notes,
        };
      });
    }

    // Format photos
    const photos = photosResult.map(p => ({
      id: p.id,
      photo_url: p.photo_url,
      photo_type: p.photo_type || 'progress',
      title: p.title || undefined,
      taken_at: p.taken_at || p.created_at,
    }));

    // Format products
    const products = productsResult.map(p => ({
      id: p.id,
      name: p.name,
      brand: p.brand || undefined,
      category: p.category || undefined,
      image_url: p.image_url || undefined,
      notes: p.notes || undefined,
      added_via: p.added_via || 'manual',
      days_used: p.days_used || 0,
      created_at: p.created_at,
    }));

    // Format notes
    const notes = notesResult.map(n => ({
      id: n.id,
      content: n.content,
      created_at: n.created_at,
      updated_at: n.updated_at || undefined,
    }));

    // Audit log: Professional accessing client's full PHI profile
    await logAuditFromRequest(req, 'VIEW', 'user_profile', clientId, {
      accessed_by: 'professional',
      includes: {
        stats: true,
        treatment_plans: treatmentPlans.length,
        routines: assignedRoutines.length,
        products: products.length,
        photos: photos.length,
        notes: notes.length,
      },
    });

    console.log(`✅ Client profile fetched successfully`);

    res.status(200).json({
      success: true,
      data: {
        stats,
        treatmentPlans,
        assignedRoutines,
        products,
        photos,
        notes,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching client profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client profile',
    } as ApiResponse);
  }
});

/**
 * PUT /professional/clients/:clientId/profile
 * Update client profile (full_name, phone, skin_type, concerns)
 */
router.put('/clients/:clientId/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;
    const { full_name, phone, skin_type, concerns } = req.body;

    console.log(`✏️ Updating profile for client: ${clientId}`);

    // Verify client belongs to professional
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

    // Update profile
    await query(
      `UPDATE user_profiles SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        skin_type = COALESCE($3, skin_type),
        concerns = COALESCE($4, concerns),
        updated_at = NOW()
       WHERE id = $5`,
      [full_name, phone, skin_type, concerns, clientId]
    );

    console.log(`✅ Client profile updated`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating client profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client profile',
    } as ApiResponse);
  }
});

/**
 * GET /professional/clients/:clientId/notes
 * Get all notes for a client
 */
router.get('/clients/:clientId/notes', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;

    console.log(`📝 Fetching notes for client: ${clientId}`);

    // Verify client belongs to professional
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

    const notes = await query<ClientNote>(
      `SELECT * FROM client_notes 
       WHERE client_id = $1 AND professional_id = $2
       ORDER BY created_at DESC`,
      [clientId, professionalId]
    );

    console.log(`✅ Found ${notes.length} notes`);

    res.status(200).json({
      success: true,
      data: { notes },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching client notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notes',
    } as ApiResponse);
  }
});

/**
 * POST /professional/clients/:clientId/notes
 * Add a note for a client
 */
router.post('/clients/:clientId/notes', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const clientId = req.params.clientId;
    const { content } = req.body;

    if (!content?.trim()) {
      res.status(400).json({
        success: false,
        error: 'Note content is required',
      } as ApiResponse);
      return;
    }

    console.log(`📝 Adding note for client: ${clientId}`);

    // Verify client belongs to professional
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

    const note = await queryOne<ClientNote>(
      `INSERT INTO client_notes (client_id, professional_id, content, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [clientId, professionalId, content.trim()]
    );

    console.log(`✅ Note added: ${note?.id}`);

    res.status(201).json({
      success: true,
      data: { note },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error adding note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add note',
    } as ApiResponse);
  }
});

/**
 * PUT /professional/clients/:clientId/notes/:noteId
 * Update a note
 */
router.put('/clients/:clientId/notes/:noteId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { clientId, noteId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      res.status(400).json({
        success: false,
        error: 'Note content is required',
      } as ApiResponse);
      return;
    }

    console.log(`✏️ Updating note: ${noteId}`);

    const note = await queryOne<ClientNote>(
      `UPDATE client_notes SET
        content = $1,
        updated_at = NOW()
       WHERE id = $2 AND client_id = $3 AND professional_id = $4
       RETURNING *`,
      [content.trim(), noteId, clientId, professionalId]
    );

    if (!note) {
      res.status(404).json({
        success: false,
        error: 'Note not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Note updated: ${noteId}`);

    res.status(200).json({
      success: true,
      data: { note },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update note',
    } as ApiResponse);
  }
});

/**
 * DELETE /professional/clients/:clientId/notes/:noteId
 * Delete a note
 */
router.delete('/clients/:clientId/notes/:noteId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { clientId, noteId } = req.params;

    console.log(`🗑️ Deleting note: ${noteId}`);

    const result = await query(
      `DELETE FROM client_notes 
       WHERE id = $1 AND client_id = $2 AND professional_id = $3
       RETURNING id`,
      [noteId, clientId, professionalId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Note not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Note deleted: ${noteId}`);

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete note',
    } as ApiResponse);
  }
});

// ============================================================================
// ANALYTICS ENDPOINT
// ============================================================================

interface AnalyticsClientData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  compliance: number;
  currentStreak: number;
  longestStreak: number;
  level: string;
  points: number;
  totalRoutinesCompleted: number;
  lastCompletionDate: string | null;
  joinedAt: string;
  routineCompletedToday: boolean;
}

interface AnalyticsOverviewMetrics {
  totalClients: number;
  avgCompliance: number;
  avgStreak: number;
  goldPlusClients: number;
  completedToday: number;
  totalPhotos: number;
  totalProducts: number;
  activeTreatmentPlans: number;
}

interface AnalyticsTrendData {
  date: string;
  completions: number;
  photos: number;
}

interface AnalyticsProductData {
  category: string;
  count: number;
}

/**
 * GET /professional/analytics
 * Get comprehensive analytics data for the professional dashboard
 */
router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const timePeriod = req.query.period as string || '30';

    console.log(`📊 Fetching analytics for professional: ${professionalId}, period: ${timePeriod}`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (timePeriod !== 'all') {
      startDate.setDate(startDate.getDate() - parseInt(timePeriod));
    } else {
      startDate.setFullYear(startDate.getFullYear() - 10);
    }
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Step 1: Get client relationships
    const relationships = await query<{ client_id: string; created_at: string }>(
      `SELECT client_id, created_at FROM client_professional_relationships 
       WHERE professional_id = $1 AND status = 'active'`,
      [professionalId]
    );

    const clientIds = relationships.map(r => r.client_id);

    if (clientIds.length === 0) {
      console.log(`✅ No clients found`);
      res.status(200).json({
        success: true,
        data: {
          clients: [],
          overviewMetrics: {
            totalClients: 0,
            avgCompliance: 0,
            avgStreak: 0,
            goldPlusClients: 0,
            completedToday: 0,
            totalPhotos: 0,
            totalProducts: 0,
            activeTreatmentPlans: 0,
          },
          trendData: [],
          productAnalytics: [],
          previousMetrics: {},
        },
      } as ApiResponse);
      return;
    }

    // Step 2: Fetch all data in parallel
    const [
      profilesResult,
      gamificationResult,
      completionsResult,
      todayCompletionsResult,
      photosResult,
      productsResult,
      treatmentPlansResult,
    ] = await Promise.all([
      // User profiles
      query<{
        id: string;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
        created_at: string;
      }>(
        `SELECT id, full_name, email, avatar_url, created_at FROM user_profiles WHERE id = ANY($1)`,
        [clientIds]
      ),

      // Gamification data
      query<{
        user_id: string;
        current_streak: number;
        longest_streak: number;
        points: number;
        level: string;
        total_routines_completed: number;
        last_completion_date: string | null;
      }>(
        `SELECT * FROM user_gamification WHERE user_id = ANY($1)`,
        [clientIds]
      ),

      // Routine completions for the period
      query<{ client_id: string; completion_date: string; routine_type: string }>(
        `SELECT client_id, completion_date, routine_type FROM routine_completions 
         WHERE client_id = ANY($1) AND completion_date >= $2 AND completion_date <= $3`,
        [clientIds, startDateStr, endDateStr]
      ),

      // Today's completions
      query<{ client_id: string }>(
        `SELECT DISTINCT client_id FROM routine_completions 
         WHERE client_id = ANY($1) AND completion_date = $2`,
        [clientIds, today]
      ),

      // Progress photos for the period
      query<{ id: string; client_id: string; created_at: string }>(
        `SELECT id, client_id, created_at FROM progress_photos 
         WHERE client_id = ANY($1) AND created_at >= $2 AND created_at <= $3`,
        [clientIds, startDate.toISOString(), endDate.toISOString()]
      ),

      // Products (professional's library)
      query<{ id: string; category: string | null }>(
        `SELECT id, category FROM products WHERE professional_id = $1 AND is_active = true`,
        [professionalId]
      ),

      // Treatment plans
      query<{ id: string; status: string }>(
        `SELECT id, status FROM treatment_plans WHERE professional_id = $1`,
        [professionalId]
      ),
    ]);

    const todayClientIds = new Set(todayCompletionsResult.map(c => c.client_id));

    // Create lookup maps
    const gamificationMap = new Map<string, typeof gamificationResult[0]>();
    gamificationResult.forEach(g => gamificationMap.set(g.user_id, g));

    const relationshipMap = new Map<string, typeof relationships[0]>();
    relationships.forEach(r => relationshipMap.set(r.client_id, r));

    // Calculate compliance for each client
    const daysInPeriod = timePeriod === 'all' ? 365 : parseInt(timePeriod);
    const expectedCompletions = daysInPeriod * 2; // AM and PM routines

    // Build client analytics
    const clients: AnalyticsClientData[] = profilesResult.map(profile => {
      const gamification = gamificationMap.get(profile.id);
      const clientCompletions = completionsResult.filter(c => c.client_id === profile.id);
      const compliance = Math.min(100, Math.round((clientCompletions.length / expectedCompletions) * 100));
      const relationship = relationshipMap.get(profile.id);

      return {
        id: profile.id,
        name: profile.full_name || 'Unknown',
        email: profile.email || '',
        avatar_url: profile.avatar_url,
        compliance,
        currentStreak: gamification?.current_streak || 0,
        longestStreak: gamification?.longest_streak || 0,
        level: gamification?.level || 'Bronze',
        points: gamification?.points || 0,
        totalRoutinesCompleted: gamification?.total_routines_completed || 0,
        lastCompletionDate: gamification?.last_completion_date || null,
        joinedAt: relationship?.created_at || profile.created_at,
        routineCompletedToday: todayClientIds.has(profile.id),
      };
    });

    // Calculate overview metrics
    const avgCompliance = clients.length > 0
      ? Math.round(clients.reduce((a, c) => a + c.compliance, 0) / clients.length)
      : 0;
    const avgStreak = clients.length > 0
      ? Math.round(clients.reduce((a, c) => a + c.currentStreak, 0) / clients.length)
      : 0;
    const goldPlusClients = clients.filter(c =>
      ['Gold', 'Platinum', 'Diamond'].includes(c.level)
    ).length;
    const completedToday = todayClientIds.size;
    const activePlans = treatmentPlansResult.filter(tp => tp.status === 'active').length;

    const overviewMetrics: AnalyticsOverviewMetrics = {
      totalClients: clients.length,
      avgCompliance,
      avgStreak,
      goldPlusClients,
      completedToday,
      totalPhotos: photosResult.length,
      totalProducts: productsResult.length,
      activeTreatmentPlans: activePlans,
    };

    // Calculate trend data (daily completions and photos for last 30 days max)
    const trendMap = new Map<string, { completions: number; photos: number }>();
    const days = timePeriod === 'all' ? 30 : Math.min(parseInt(timePeriod), 30);

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendMap.set(dateStr, { completions: 0, photos: 0 });
    }

    completionsResult.forEach(c => {
      const existing = trendMap.get(c.completion_date);
      if (existing) {
        existing.completions++;
      }
    });

    photosResult.forEach(p => {
      const dateStr = new Date(p.created_at).toISOString().split('T')[0];
      const existing = trendMap.get(dateStr);
      if (existing) {
        existing.photos++;
      }
    });

    const trendData: AnalyticsTrendData[] = Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate product analytics by category
    const categoryMap = new Map<string, number>();
    productsResult.forEach(p => {
      const cat = p.category || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });

    const productAnalytics: AnalyticsProductData[] = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate previous period metrics for comparison
    let previousMetrics: { avgCompliance?: number } = {};
    
    if (timePeriod !== 'all') {
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - parseInt(timePeriod));
      const prevStartDateStr = prevStartDate.toISOString().split('T')[0];

      const prevCompletionsResult = await query<{ client_id: string }>(
        `SELECT client_id FROM routine_completions 
         WHERE client_id = ANY($1) AND completion_date >= $2 AND completion_date < $3`,
        [clientIds, prevStartDateStr, startDateStr]
      );

      const prevCompliance = clients.length > 0 && prevCompletionsResult
        ? Math.round((prevCompletionsResult.length / (expectedCompletions * clients.length)) * 100)
        : 0;

      previousMetrics = { avgCompliance: prevCompliance };
    }

    console.log(`✅ Analytics data fetched: ${clients.length} clients`);

    res.status(200).json({
      success: true,
      data: {
        clients,
        overviewMetrics,
        trendData,
        productAnalytics,
        previousMetrics,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data',
    } as ApiResponse);
  }
});

// ============================================================================
// PROFESSIONAL NOTIFICATIONS ENDPOINTS
// ============================================================================

interface ProfessionalNotification {
  id: string;
  client_id: string;
  professional_id: string;
  content: string;
  read_status: boolean;
  sender_type: string | null;
  created_at: string;
  client_name: string | null;
  client_avatar: string | null;
}

/**
 * GET /professional/notifications/unread
 * Get unread notes from clients for the professional
 */
router.get('/notifications/unread', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`🔔 Fetching unread notifications for professional: ${professionalId}`);

    // Fetch unread notes from clients (sender_type = 'client' or null)
    const notes = await query<{
      id: string;
      client_id: string;
      professional_id: string;
      content: string;
      read_status: boolean;
      sender_type: string | null;
      created_at: string;
    }>(
      `SELECT id, client_id, professional_id, content, read_status, sender_type, created_at
       FROM routine_notes
       WHERE professional_id = $1 
         AND read_status = false
         AND professional_deleted = false
         AND (sender_type = 'client' OR sender_type IS NULL)
       ORDER BY created_at DESC`,
      [professionalId]
    );

    if (notes.length === 0) {
      console.log(`ℹ️ No unread notifications for professional: ${professionalId}`);
      res.status(200).json({
        success: true,
        data: { notifications: [], count: 0 },
      } as ApiResponse);
      return;
    }

    // Get unique client IDs
    const clientIds = [...new Set(notes.map(n => n.client_id))];

    // Fetch client profiles
    const clients = await query<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    }>(
      `SELECT id, full_name, avatar_url FROM user_profiles WHERE id = ANY($1)`,
      [clientIds]
    );

    const clientsMap = new Map(clients.map(c => [c.id, c]));

    // Map notifications with client info
    const notificationsWithClientInfo: ProfessionalNotification[] = notes.map(note => {
      const client = clientsMap.get(note.client_id);
      return {
        ...note,
        client_name: client?.full_name || 'Unknown Client',
        client_avatar: client?.avatar_url || null,
      };
    });

    console.log(`✅ Found ${notificationsWithClientInfo.length} unread notifications`);

    res.status(200).json({
      success: true,
      data: { 
        notifications: notificationsWithClientInfo,
        count: notificationsWithClientInfo.length,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching unread notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    } as ApiResponse);
  }
});

/**
 * PATCH /professional/notifications/:noteId/read
 * Mark a single notification as read
 */
router.patch('/notifications/:noteId/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { noteId } = req.params;

    console.log(`📝 Marking notification ${noteId} as read for professional: ${professionalId}`);

    const result = await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE id = $1 AND professional_id = $2
       RETURNING id`,
      [noteId, professionalId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Notification not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Notification marked as read: ${noteId}`);

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
 * PATCH /professional/notifications/mark-all-read
 * Mark all unread notifications as read
 */
router.patch('/notifications/mark-all-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📝 Marking all notifications as read for professional: ${professionalId}`);

    const result = await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE professional_id = $1 
         AND read_status = false
         AND professional_deleted = false
         AND (sender_type = 'client' OR sender_type IS NULL)
       RETURNING id`,
      [professionalId]
    );

    console.log(`✅ Marked ${result.length} notifications as read`);

    res.status(200).json({
      success: true,
      message: `${result.length} notification(s) marked as read`,
      data: { count: result.length },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
    } as ApiResponse);
  }
});

// ============================================================================
// CLIENT INVITATION ENDPOINT
// ============================================================================

import { 
  sendClientInvitationEmail,
  generateInvitationToken,
  getInvitationTokenExpiry,
  sendClientInvitationWithTokenEmail,
} from '../lib/email.js';

interface ClientInvitation {
  id: string;
  email: string;
  professional_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  token: string;
}

/**
 * POST /professional/clients/invite
 * Invite a client by email - generates token and saves to client_invitations table
 */
router.post('/clients/invite', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      } as ApiResponse);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`📧 Inviting client: ${normalizedEmail} by professional: ${professionalId}`);

    // Get professional's profile for the invitation email
    const professional = await queryOne<{
      id: string;
      full_name: string;
      business_name: string;
    }>(
      `SELECT id, full_name, business_name FROM user_profiles WHERE id = $1`,
      [professionalId]
    );

    if (!professional) {
      res.status(404).json({
        success: false,
        error: 'Professional profile not found',
      } as ApiResponse);
      return;
    }

    // Check if a user with this email already exists
    const existingUser = await queryOne<{
      id: string;
      email: string;
      role: string;
      full_name: string;
    }>(
      `SELECT id, email, role, full_name FROM user_profiles WHERE email = $1`,
      [normalizedEmail]
    );

    if (existingUser) {
      // User exists - check if relationship already exists
      const existingRelationship = await queryOne<ClientProfessionalRelationship>(
        `SELECT * FROM client_professional_relationships 
         WHERE professional_id = $1 AND client_id = $2`,
        [professionalId, existingUser.id]
      );

      if (existingRelationship) {
        if (existingRelationship.status === 'active') {
          res.status(400).json({
            success: false,
            error: 'This client is already connected to your account.',
          } as ApiResponse);
          return;
        }
        // Reactivate the relationship if it was inactive
        await query(
          `UPDATE client_professional_relationships 
           SET status = 'active', updated_at = NOW() 
           WHERE id = $1`,
          [existingRelationship.id]
        );
      } else {
        // Create new relationship
        await query(
          `INSERT INTO client_professional_relationships 
           (professional_id, client_id, status, created_at, updated_at)
           VALUES ($1, $2, 'active', NOW(), NOW())`,
          [professionalId, existingUser.id]
        );
      }

      console.log(`✅ Client ${existingUser.full_name} added directly (already registered)`);

      res.status(200).json({
        success: true,
        message: `${existingUser.full_name} has been added to your client list.`,
        alreadyRegistered: true,
      } as ApiResponse);
      return;
    }

    // User doesn't exist - check for pending invitation in client_invitations table
    const existingInvitation = await queryOne<ClientInvitation>(
      `SELECT * FROM client_invitations 
       WHERE professional_id = $1 AND email = $2 AND status = 'pending'
       AND expires_at > NOW()`,
      [professionalId, normalizedEmail]
    );

    if (existingInvitation) {
      res.status(400).json({
        success: false,
        error: 'An invitation has already been sent to this email address and is still pending.',
        alreadyInvited: true,
      } as ApiResponse);
      return;
    }

    // Generate unique invitation token
    const invitationToken = generateInvitationToken();
    const expiresAt = getInvitationTokenExpiry();

    // Delete any expired invitations for this email/professional combo
    await query(
      `DELETE FROM client_invitations 
       WHERE professional_id = $1 AND email = $2 AND expires_at <= NOW()`,
      [professionalId, normalizedEmail]
    );

    // Create invitation in client_invitations table
    await query(
      `INSERT INTO client_invitations 
       (email, professional_id, status, token, created_at, expires_at)
       VALUES ($1, $2, 'pending', $3, NOW(), $4)`,
      [normalizedEmail, professionalId, invitationToken, expiresAt.toISOString()]
    );

    // Send invitation email with token link
    const emailResult = await sendClientInvitationWithTokenEmail(
      normalizedEmail,
      professional.full_name || 'Your Skincare Professional',
      professional.business_name || 'SkinAura PRO',
      invitationToken
    );

    if (!emailResult.success) {
      console.error('❌ Failed to send invitation email:', emailResult.error);
      // Still return success since invitation was created
    }

    console.log(`✅ Invitation with token sent to ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: `Invitation sent to ${normalizedEmail}. They will receive an email with a link to create their account.`,
      alreadyRegistered: false,
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error inviting client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation',
    } as ApiResponse);
  }
});

// ============================================================================
// PRODUCT BULK IMPORT ENDPOINT
// ============================================================================

interface BulkProductInput {
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  purchase_url: string | null;
  ingredients: string[];
  skin_types: string[];
  concerns: string[];
  is_active: boolean;
  is_global: boolean;
}

/**
 * POST /professional/products/bulk-import
 * Bulk import products from CSV
 */
router.post('/products/bulk-import', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { products } = req.body as { products: BulkProductInput[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Products array is required',
      } as ApiResponse);
      return;
    }

    console.log(`📦 Bulk importing ${products.length} products for professional: ${professionalId}`);

    const insertedProducts: any[] = [];
    const errors: string[] = [];

    // Process products in batches of 10
    const batchSize = 10;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        // Build bulk insert query
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const product of batch) {
          placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11})`);
          values.push(
            professionalId,
            product.name,
            product.brand || null,
            product.category || null,
            product.description || null,
            product.price || null,
            product.image_url || null,
            product.purchase_url || null,
            product.ingredients || [],
            product.skin_types || [],
            product.is_active !== false,
            product.is_global === true
          );
          paramIndex += 12;
        }

        const insertQuery = `
          INSERT INTO products 
            (professional_id, name, brand, category, description, price, image_url, purchase_url, ingredients, skin_types, is_active, is_global)
          VALUES ${placeholders.join(', ')}
          RETURNING id, name
        `;

        const result = await query<{ id: string; name: string }>(insertQuery, values);
        insertedProducts.push(...result);

      } catch (batchError: any) {
        console.error(`❌ Batch ${batchNumber} error:`, batchError);
        errors.push(`Batch ${batchNumber}: ${batchError.message || 'Unknown error'}`);
      }
    }

    const successCount = insertedProducts.length;
    const failedCount = products.length - successCount;

    console.log(`✅ Bulk import complete: ${successCount} success, ${failedCount} failed`);

    res.status(200).json({
      success: true,
      data: {
        success: successCount,
        failed: failedCount,
        errors,
        products: insertedProducts,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error bulk importing products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import products',
    } as ApiResponse);
  }
});

// ============================================================================
// ROUTINE STEP PRODUCTS ENDPOINTS
// ============================================================================

interface LinkedProduct {
  id: string;
  routine_step_id: string;
  product_id: string;
  notes: string | null;
  created_at: string;
}

interface ProductDetails {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
}

/**
 * GET /professional/routines/:routineId/step-products
 * Fetch all linked products for a routine's steps
 */
router.get('/routines/:routineId/step-products', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { routineId } = req.params;

    console.log(`📦 Fetching linked products for routine ${routineId}`);

    // Verify routine belongs to this professional
    const routine = await queryOne<{ id: string }>(
      `SELECT id FROM routine_templates WHERE id = $1 AND professional_id = $2`,
      [routineId, professionalId]
    );

    if (!routine) {
      res.status(404).json({
        success: false,
        error: 'Routine not found or access denied',
      } as ApiResponse);
      return;
    }

    // Fetch step IDs for this routine
    const steps = await query<{ id: string }>(
      `SELECT id FROM routine_steps WHERE routine_id = $1`,
      [routineId]
    );

    if (steps.length === 0) {
      res.json({
        success: true,
        data: { linkedProducts: {} },
      } as ApiResponse);
      return;
    }

    const stepIds = steps.map(s => s.id);

    // Fetch linked products with product details
    const linkedProducts = await query<LinkedProduct & ProductDetails>(
      `SELECT 
         rsp.id,
         rsp.routine_step_id,
         rsp.product_id,
         rsp.notes,
         rsp.created_at,
         p.name,
         p.brand,
         p.category,
         p.image_url,
         p.price,
         p.currency
       FROM routine_step_products rsp
       LEFT JOIN products p ON rsp.product_id = p.id
       WHERE rsp.routine_step_id = ANY($1)`,
      [stepIds]
    );

    // Transform to map format: stepId -> linkedProduct with product details
    const linksMap: Record<string, any> = {};
    linkedProducts.forEach(link => {
      linksMap[link.routine_step_id] = {
        id: link.id,
        routine_step_id: link.routine_step_id,
        product_id: link.product_id,
        notes: link.notes,
        created_at: link.created_at,
        product: {
          id: link.product_id,
          name: link.name,
          brand: link.brand,
          category: link.category,
          image_url: link.image_url,
          price: link.price,
          currency: link.currency,
        },
      };
    });

    console.log(`✅ Found ${linkedProducts.length} linked products`);

    res.json({
      success: true,
      data: { linkedProducts: linksMap },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching step products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch linked products',
    } as ApiResponse);
  }
});

/**
 * GET /professional/products/list
 * Fetch products for the professional (owned or global)
 */
router.get('/products/list', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📦 Fetching products for professional ${professionalId}`);

    const products = await query<ProductDetails>(
      `SELECT id, name, brand, category, image_url, price, currency
       FROM products
       WHERE (professional_id = $1 OR is_global = true) AND is_active = true
       ORDER BY name`,
      [professionalId]
    );

    console.log(`✅ Found ${products.length} products`);

    res.json({
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

/**
 * POST /professional/routine-steps/:stepId/link-product
 * Link a product to a routine step
 */
router.post('/routine-steps/:stepId/link-product', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { stepId } = req.params;
    const { product_id, notes } = req.body;

    console.log(`🔗 Linking product ${product_id} to step ${stepId}`);

    if (!product_id) {
      res.status(400).json({
        success: false,
        error: 'Product ID is required',
      } as ApiResponse);
      return;
    }

    // Verify step belongs to a routine owned by this professional
    const step = await queryOne<{ id: string; routine_id: string }>(
      `SELECT rs.id, rs.routine_id
       FROM routine_steps rs
       JOIN routine_templates rt ON rs.routine_id = rt.id
       WHERE rs.id = $1 AND rt.professional_id = $2`,
      [stepId, professionalId]
    );

    if (!step) {
      res.status(404).json({
        success: false,
        error: 'Step not found or access denied',
      } as ApiResponse);
      return;
    }

    // Check if link already exists
    const existingLink = await queryOne<LinkedProduct>(
      `SELECT * FROM routine_step_products WHERE routine_step_id = $1`,
      [stepId]
    );

    if (existingLink) {
      res.status(400).json({
        success: false,
        error: 'Step already has a linked product. Use update instead.',
      } as ApiResponse);
      return;
    }

    // Create the link
    const newLink = await queryOne<LinkedProduct>(
      `INSERT INTO routine_step_products (routine_step_id, product_id, notes, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [stepId, product_id, notes || null]
    );

    // Fetch product details
    const product = await queryOne<ProductDetails>(
      `SELECT id, name, brand, category, image_url, price, currency
       FROM products WHERE id = $1`,
      [product_id]
    );

    console.log(`✅ Product linked successfully`);

    res.json({
      success: true,
      data: {
        linkedProduct: {
          ...newLink,
          product,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error linking product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link product',
    } as ApiResponse);
  }
});

/**
 * PUT /professional/routine-step-products/:linkId
 * Update a linked product
 */
router.put('/routine-step-products/:linkId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { linkId } = req.params;
    const { product_id, notes } = req.body;

    console.log(`📝 Updating product link ${linkId}`);

    if (!product_id) {
      res.status(400).json({
        success: false,
        error: 'Product ID is required',
      } as ApiResponse);
      return;
    }

    // Verify link exists and belongs to a routine owned by this professional
    const existingLink = await queryOne<LinkedProduct & { professional_id: string }>(
      `SELECT rsp.*, rt.professional_id
       FROM routine_step_products rsp
       JOIN routine_steps rs ON rsp.routine_step_id = rs.id
       JOIN routine_templates rt ON rs.routine_id = rt.id
       WHERE rsp.id = $1 AND rt.professional_id = $2`,
      [linkId, professionalId]
    );

    if (!existingLink) {
      res.status(404).json({
        success: false,
        error: 'Product link not found or access denied',
      } as ApiResponse);
      return;
    }

    // Update the link
    const updatedLink = await queryOne<LinkedProduct>(
      `UPDATE routine_step_products
       SET product_id = $1, notes = $2
       WHERE id = $3
       RETURNING *`,
      [product_id, notes || null, linkId]
    );

    // Fetch product details
    const product = await queryOne<ProductDetails>(
      `SELECT id, name, brand, category, image_url, price, currency
       FROM products WHERE id = $1`,
      [product_id]
    );

    console.log(`✅ Product link updated successfully`);

    res.json({
      success: true,
      data: {
        linkedProduct: {
          ...updatedLink,
          product,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating product link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product link',
    } as ApiResponse);
  }
});

/**
 * DELETE /professional/routine-step-products/:linkId
 * Unlink a product from a routine step
 */
router.delete('/routine-step-products/:linkId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { linkId } = req.params;

    console.log(`🗑️ Deleting product link ${linkId}`);

    // Verify link exists and belongs to a routine owned by this professional
    const existingLink = await queryOne<LinkedProduct & { professional_id: string }>(
      `SELECT rsp.*, rt.professional_id
       FROM routine_step_products rsp
       JOIN routine_steps rs ON rsp.routine_step_id = rs.id
       JOIN routine_templates rt ON rs.routine_id = rt.id
       WHERE rsp.id = $1 AND rt.professional_id = $2`,
      [linkId, professionalId]
    );

    if (!existingLink) {
      res.status(404).json({
        success: false,
        error: 'Product link not found or access denied',
      } as ApiResponse);
      return;
    }

    // Delete the link
    await query(
      `DELETE FROM routine_step_products WHERE id = $1`,
      [linkId]
    );

    console.log(`✅ Product link deleted successfully`);

    res.json({
      success: true,
      message: 'Product unlinked successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting product link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlink product',
    } as ApiResponse);
  }
});

// ============================================================================
// SHOPIFY INTEGRATION ENDPOINTS
// ============================================================================

interface ShopifyConnection {
  id: string;
  user_id: string;
  shop_domain: string;
  access_token: string;
  created_at: string;
}

interface ShopifyProduct {
  shopify_id: string;
  title: string;
  vendor: string;
  product_type: string;
  description: string;
  price: number;
  image_url: string | null;
  url: string;
  tags: string[];
  sku: string | null;
  inventory_quantity: number | null;
}

// Encryption key for access tokens (use a separate key for extra security)
const SHOPIFY_ENCRYPTION_KEY = process.env.SHOPIFY_ENCRYPTION_KEY || env.JWT_SECRET;

/**
 * Encrypt access token for storage
 */
const encryptAccessToken = (token: string): string => {
  const key = crypto.scryptSync(SHOPIFY_ENCRYPTION_KEY, 'shopify-salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt access token from storage
 */
const decryptAccessToken = (encryptedToken: string): string => {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  
  const key = crypto.scryptSync(SHOPIFY_ENCRYPTION_KEY, 'shopify-salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

/**
 * Normalize shop domain (e.g., "mystore.myshopify.com" or "mystore")
 * Handles various input formats:
 * - "mystore" → "mystore.myshopify.com"
 * - "mystore.myshopify.com" → "mystore.myshopify.com"
 * - "https://mystore.myshopify.com" → "mystore.myshopify.com"
 * - "admin.shopify.com/store/mystore" → "mystore.myshopify.com"
 * - "https://admin.shopify.com/store/mystore/..." → "mystore.myshopify.com"
 */
const normalizeShopDomain = (input: string): string => {
  let domain = input.trim();
  
  // Remove protocol if present
  domain = domain.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes and paths
  domain = domain.replace(/\/+$/, '');
  
  // Handle admin.shopify.com/store/SHOP_NAME format
  const adminMatch = domain.match(/admin\.shopify\.com\/store\/([^\/]+)/i);
  if (adminMatch) {
    domain = `${adminMatch[1]}.myshopify.com`;
    console.log(`📝 Converted admin URL to: ${domain}`);
    return domain.toLowerCase();
  }
  
  // Handle SHOP_NAME.myshopify.com/admin/... or similar paths
  const myshopifyMatch = domain.match(/([^\/]+\.myshopify\.com)/i);
  if (myshopifyMatch) {
    domain = myshopifyMatch[1];
    return domain.toLowerCase();
  }
  
  // If no dots, assume it's just the shop name
  if (!domain.includes('.')) {
    domain = `${domain}.myshopify.com`;
    return domain.toLowerCase();
  }
  
  // If it contains myshopify.com somewhere, extract just the domain part
  if (domain.includes('myshopify.com')) {
    // Remove any path
    domain = domain.split('/')[0];
    return domain.toLowerCase();
  }
  
  // For custom domains, warn but accept
  console.log(`⚠️ Custom domain detected: ${domain} - this may not work with OAuth`);
  domain = domain.split('/')[0]; // Remove any paths
  
  return domain.toLowerCase();
};

/**
 * Generate nonce for OAuth state validation
 */
const generateNonce = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Store nonces temporarily (in production, use Redis or database)
const oauthNonces = new Map<string, { userId: string; shopDomain: string; expiresAt: number }>();

// Clean up expired nonces every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of oauthNonces.entries()) {
    if (data.expiresAt < now) {
      oauthNonces.delete(nonce);
    }
  }
}, 5 * 60 * 1000);

/**
 * GET /professional/shopify/status
 * Check if the professional has a connected Shopify store
 */
router.get('/shopify/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`🔍 Checking Shopify connection status for: ${professionalId}`);

    const connection = await queryOne<ShopifyConnection>(
      `SELECT id, shop_domain, created_at FROM shopify_connections WHERE user_id = $1`,
      [professionalId]
    );

    if (connection) {
      console.log(`✅ Shopify connected: ${connection.shop_domain}`);
      res.status(200).json({
        success: true,
        data: {
          connected: true,
          shop_domain: connection.shop_domain,
          connected_at: connection.created_at,
        },
      } as ApiResponse);
    } else {
      console.log(`ℹ️ No Shopify connection found`);
      res.status(200).json({
        success: true,
        data: {
          connected: false,
        },
      } as ApiResponse);
    }

  } catch (error) {
    console.error('❌ Error checking Shopify status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check Shopify connection status',
    } as ApiResponse);
  }
});

/**
 * POST /professional/shopify/connect
 * Initiate Shopify OAuth flow - returns the authorization URL
 */
router.post('/shopify/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { shop_domain } = req.body;

    if (!shop_domain) {
      res.status(400).json({
        success: false,
        error: 'Shop domain is required',
      } as ApiResponse);
      return;
    }

    // Validate Shopify API credentials are configured
    if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_API_SECRET) {
      res.status(500).json({
        success: false,
        error: 'Shopify integration is not configured. Please contact support.',
      } as ApiResponse);
      return;
    }

    const normalizedDomain = normalizeShopDomain(shop_domain);
    console.log(`🔗 Initiating Shopify OAuth for: ${normalizedDomain}`);

    // Check if already connected
    const existingConnection = await queryOne<ShopifyConnection>(
      `SELECT * FROM shopify_connections WHERE user_id = $1`,
      [professionalId]
    );

    if (existingConnection) {
      res.status(400).json({
        success: false,
        error: 'You already have a connected Shopify store. Please disconnect first.',
      } as ApiResponse);
      return;
    }

    // Generate nonce for state parameter
    const nonce = generateNonce();
    const storedDomain = normalizedDomain.toLowerCase().trim();
    oauthNonces.set(nonce, {
      userId: professionalId,
      shopDomain: storedDomain,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    
    console.log(`📝 Stored nonce: ${nonce} for shop: "${storedDomain}"`);

    // Build Shopify OAuth URL
    const redirectUri = env.SHOPIFY_REDIRECT_URI || `${env.FRONTEND_URL}/shopify/callback`;
    const scopes = env.SHOPIFY_SCOPES || 'read_products';
    
    const authUrl = `https://${normalizedDomain}/admin/oauth/authorize?` +
      `client_id=${env.SHOPIFY_API_KEY}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${nonce}`;

    console.log(`✅ OAuth URL generated for: ${normalizedDomain}`);
    console.log(`🔗 Full auth URL: ${authUrl}`);

    res.status(200).json({
      success: true,
      data: {
        auth_url: authUrl,
        shop_domain: normalizedDomain,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error initiating Shopify connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate Shopify connection',
    } as ApiResponse);
  }
});

/**
 * POST /professional/shopify/callback
 * Handle Shopify OAuth callback - exchange code for access token
 */
router.post('/shopify/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, shop } = req.body;

    console.log(`🔐 Received OAuth callback - code: ${code?.substring(0, 10)}..., state: ${state}, shop: ${shop}`);

    if (!code || !state || !shop) {
      console.error('❌ Missing OAuth parameters');
      res.status(400).json({
        success: false,
        error: 'Missing required OAuth parameters',
      } as ApiResponse);
      return;
    }

    console.log(`🔐 Processing Shopify OAuth callback for shop: ${shop}`);
    console.log(`📋 Available nonces: ${oauthNonces.size}`);

    // Validate state/nonce
    const nonceData = oauthNonces.get(state);
    if (!nonceData) {
      console.error(`❌ Nonce not found for state: ${state}`);
      console.error(`📋 Available nonce keys: ${Array.from(oauthNonces.keys()).join(', ')}`);
      res.status(400).json({
        success: false,
        error: 'Invalid or expired OAuth state. Please try connecting again.',
      } as ApiResponse);
      return;
    }
    
    console.log(`✅ Nonce found for user: ${nonceData.userId}, stored shop: ${nonceData.shopDomain}`);

    // Clean up nonce
    oauthNonces.delete(state);

    // Normalize the shop domain from callback - trust Shopify's response
    // The state parameter already validates this is a legitimate callback
    const normalizedShop = normalizeShopDomain(shop);
    console.log(`🔍 Shop from callback: "${normalizedShop}" (originally requested: "${nonceData.shopDomain}")`);
    
    // Log if there's a mismatch but don't block - user may have authorized a different store
    const callbackShop = normalizedShop.toLowerCase().trim();
    const storedShop = nonceData.shopDomain.toLowerCase().trim();
    
    if (callbackShop !== storedShop) {
      console.log(`⚠️ Shop differs from request - callback: "${callbackShop}", requested: "${storedShop}"`);
      console.log(`   Proceeding with authorized shop: ${callbackShop}`);
    }
    
    console.log(`✅ Using shop domain: ${normalizedShop}`);

    // Check if nonce has expired
    if (nonceData.expiresAt < Date.now()) {
      res.status(400).json({
        success: false,
        error: 'OAuth session expired. Please try connecting again.',
      } as ApiResponse);
      return;
    }

    // Exchange code for access token
    const tokenUrl = `https://${normalizedShop}/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.SHOPIFY_API_KEY,
        client_secret: env.SHOPIFY_API_SECRET,
        code: code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Shopify token exchange failed:', errorText);
      res.status(400).json({
        success: false,
        error: 'Failed to complete Shopify authorization. Please try again.',
      } as ApiResponse);
      return;
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      res.status(400).json({
        success: false,
        error: 'No access token received from Shopify.',
      } as ApiResponse);
      return;
    }

    // Encrypt and store the access token
    const encryptedToken = encryptAccessToken(accessToken);

    // Delete any existing connection (shouldn't exist, but just in case)
    await query(
      `DELETE FROM shopify_connections WHERE user_id = $1`,
      [nonceData.userId]
    );

    // Insert new connection
    await query(
      `INSERT INTO shopify_connections (user_id, shop_domain, access_token, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [nonceData.userId, normalizedShop, encryptedToken]
    );

    console.log(`✅ Shopify store connected: ${normalizedShop} for user: ${nonceData.userId}`);

    res.status(200).json({
      success: true,
      message: 'Shopify store connected successfully!',
      data: {
        shop_domain: normalizedShop,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error processing Shopify callback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete Shopify connection',
    } as ApiResponse);
  }
});

/**
 * DELETE /professional/shopify/disconnect
 * Disconnect the Shopify store
 */
router.delete('/shopify/disconnect', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`🔌 Disconnecting Shopify store for: ${professionalId}`);

    const result = await query(
      `DELETE FROM shopify_connections WHERE user_id = $1 RETURNING shop_domain`,
      [professionalId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No Shopify connection found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Shopify store disconnected`);

    res.status(200).json({
      success: true,
      message: 'Shopify store disconnected successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error disconnecting Shopify:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect Shopify store',
    } as ApiResponse);
  }
});

/**
 * GET /professional/shopify/products
 * Fetch products from the connected Shopify store
 */
router.get('/shopify/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const cursor = req.query.cursor as string | undefined;

    console.log(`📦 Fetching Shopify products for: ${professionalId}`);

    // Get the connection
    const connection = await queryOne<ShopifyConnection>(
      `SELECT * FROM shopify_connections WHERE user_id = $1`,
      [professionalId]
    );

    if (!connection) {
      res.status(400).json({
        success: false,
        error: 'No Shopify store connected. Please connect your store first.',
      } as ApiResponse);
      return;
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = decryptAccessToken(connection.access_token);
    } catch (decryptError) {
      console.error('❌ Failed to decrypt access token:', decryptError);
      res.status(500).json({
        success: false,
        error: 'Failed to access Shopify store. Please reconnect your store.',
      } as ApiResponse);
      return;
    }

    // Build GraphQL query for products
    const graphqlQuery = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              vendor
              productType
              descriptionHtml
              handle
              tags
              variants(first: 1) {
                edges {
                  node {
                    price
                    sku
                    inventoryQuantity
                  }
                }
              }
              images(first: 1) {
                edges {
                  node {
                    url
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Fetch products from Shopify
    const shopifyResponse = await fetch(
      `https://${connection.shop_domain}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: graphqlQuery,
          variables: {
            first: limit,
            after: cursor || null,
          },
        }),
      }
    );

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      console.error('❌ Shopify API error:', errorText);
      
      // Check if token is invalid
      if (shopifyResponse.status === 401) {
        res.status(401).json({
          success: false,
          error: 'Shopify access token is invalid or expired. Please reconnect your store.',
        } as ApiResponse);
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch products from Shopify',
      } as ApiResponse);
      return;
    }

    const data = await shopifyResponse.json() as {
      data?: {
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: Array<{
            node: {
              id: string;
              title: string;
              vendor: string;
              productType: string;
              descriptionHtml: string;
              handle: string;
              tags: string[];
              variants: { edges: Array<{ node: { price: string; sku: string | null; inventoryQuantity: number | null } }> };
              images: { edges: Array<{ node: { url: string } }> };
            };
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (data.errors) {
      console.error('❌ Shopify GraphQL errors:', data.errors);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch products: ' + data.errors.map(e => e.message).join(', '),
      } as ApiResponse);
      return;
    }

    // Transform products to our format
    const products: ShopifyProduct[] = (data.data?.products.edges || []).map((edge) => {
      const node = edge.node;
      const variant = node.variants.edges[0]?.node;
      const image = node.images.edges[0]?.node;
      
      // Extract the numeric ID from the GraphQL ID (e.g., "gid://shopify/Product/123456")
      const shopifyId = node.id.split('/').pop() || node.id;
      
      return {
        shopify_id: shopifyId,
        title: node.title,
        vendor: node.vendor || '',
        product_type: node.productType || '',
        description: node.descriptionHtml || '',
        price: parseFloat(variant?.price || '0'),
        image_url: image?.url || null,
        url: `https://${connection.shop_domain}/products/${node.handle}`,
        tags: node.tags || [],
        sku: variant?.sku || null,
        inventory_quantity: variant?.inventoryQuantity ?? null,
      };
    });

    const pageInfo = data.data?.products.pageInfo;

    console.log(`✅ Fetched ${products.length} products from Shopify`);

    res.status(200).json({
      success: true,
      data: {
        products,
        storeUrl: connection.shop_domain,
        hasMore: pageInfo?.hasNextPage || false,
        nextCursor: pageInfo?.endCursor || null,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching Shopify products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products from Shopify',
    } as ApiResponse);
  }
});

// ============================================================================
// PROFESSIONAL LOGO ENDPOINTS
// ============================================================================

/**
 * Initialize professional_logo table
 * Called on server startup
 */
export const initProfessionalLogoTable = async (): Promise<void> => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS professional_logo (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        professional_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
        logo_url TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ professional_logo table initialized');
  } catch (error) {
    console.error('❌ Error initializing professional_logo table:', error);
    throw error;
  }
};

/**
 * POST /professional/logo
 * Save or update professional logo
 */
router.post('/logo', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { logo_url } = req.body;

    if (!logo_url) {
      res.status(400).json({
        success: false,
        error: 'Logo URL is required',
      } as ApiResponse);
      return;
    }

    console.log(`📸 Saving logo for professional: ${professionalId}`);

    // Upsert: insert or update if exists
    const result = await queryOne<{ id: string; logo_url: string; created_at: string }>(
      `INSERT INTO professional_logo (professional_id, logo_url)
       VALUES ($1, $2)
       ON CONFLICT (professional_id)
       DO UPDATE SET logo_url = EXCLUDED.logo_url, created_at = CURRENT_TIMESTAMP
       RETURNING id, logo_url, created_at`,
      [professionalId, logo_url]
    );

    // Log audit event
    await logAuditFromRequest(
      req,
      'professional.logo.saved',
      professionalId,
      { logo_url }
    );

    console.log(`✅ Logo saved for professional: ${professionalId}`);

    res.status(200).json({
      success: true,
      message: 'Logo saved successfully',
      data: result,
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error saving logo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save logo',
    } as ApiResponse);
  }
});

/**
 * GET /professional/logo
 * Get professional logo
 */
router.get('/logo', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`📸 Fetching logo for professional: ${professionalId}`);

    const result = await queryOne<{ id: string; logo_url: string; created_at: string }>(
      `SELECT id, logo_url, created_at
       FROM professional_logo
       WHERE professional_id = $1`,
      [professionalId]
    );

    if (!result) {
      res.status(200).json({
        success: true,
        data: null,
      } as ApiResponse);
      return;
    }

    console.log(`✅ Logo found for professional: ${professionalId}`);

    res.status(200).json({
      success: true,
      data: result,
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching logo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logo',
    } as ApiResponse);
  }
});

/**
 * DELETE /professional/logo
 * Delete professional logo
 */
router.delete('/logo', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    console.log(`🗑️ Deleting logo for professional: ${professionalId}`);

    await query(
      `DELETE FROM professional_logo WHERE professional_id = $1`,
      [professionalId]
    );

    // Log audit event
    await logAuditFromRequest(
      req,
      'professional.logo.deleted',
      professionalId,
      {}
    );

    console.log(`✅ Logo deleted for professional: ${professionalId}`);

    res.status(200).json({
      success: true,
      message: 'Logo deleted successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting logo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete logo',
    } as ApiResponse);
  }
});

export default router;
