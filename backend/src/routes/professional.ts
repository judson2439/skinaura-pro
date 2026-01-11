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

export default router;
