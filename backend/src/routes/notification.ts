/**
 * Notification Routes - Routine notes/messages between professionals and clients
 */

import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface RoutineNote {
  id: string;
  client_id: string;
  professional_id: string;
  content: string;
  sender_type: 'client' | 'professional';
  read_status: boolean;
  client_deleted: boolean;
  professional_deleted: boolean;
  created_at: string;
}

interface ClientProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

// ============================================================================
// GET /notifications - Get all notifications grouped by client (for professionals)
// ============================================================================

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    // Fetch all notes for this professional
    const notes = await query<RoutineNote>(
      `SELECT * FROM routine_notes 
       WHERE professional_id = $1 AND professional_deleted = false 
       ORDER BY created_at DESC`,
      [professionalId]
    );

    if (!notes || notes.length === 0) {
      res.status(200).json({
        success: true,
        data: { clientGroups: [] },
      });
      return;
    }

    // Get unique client IDs
    const clientIds = [...new Set(notes.map(note => note.client_id))];

    // Fetch client profiles
    const clientProfiles = await query<ClientProfile>(
      `SELECT id, full_name, avatar_url FROM user_profiles WHERE id = ANY($1)`,
      [clientIds]
    );

    // Group notes by client
    const groupedByClient: { [clientId: string]: RoutineNote[] } = {};
    notes.forEach(note => {
      if (!groupedByClient[note.client_id]) {
        groupedByClient[note.client_id] = [];
      }
      groupedByClient[note.client_id].push(note);
    });

    // Create client groups with stats
    const clientGroups = Object.entries(groupedByClient).map(([clientId, clientNotes]) => {
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
    clientGroups.sort((a, b) => {
      if (b.unread_count !== a.unread_count) {
        return b.unread_count - a.unread_count;
      }
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });

    res.status(200).json({
      success: true,
      data: { clientGroups },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    });
  }
});

// ============================================================================
// GET /notifications/unread-count - Get total unread count (for badge)
// ============================================================================

router.get('/unread-count', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM routine_notes 
       WHERE professional_id = $1 
       AND professional_deleted = false 
       AND read_status = false 
       AND (sender_type = 'client' OR sender_type IS NULL)`,
      [professionalId]
    );

    res.status(200).json({
      success: true,
      data: { unreadCount: parseInt(result?.count || '0', 10) },
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count',
    });
  }
});

// ============================================================================
// PATCH /notifications/mark-all-read - Mark all notifications as read
// ============================================================================

router.patch('/mark-all-read', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE professional_id = $1 AND read_status = false`,
      [professionalId]
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all as read',
    });
  }
});

// ============================================================================
// PATCH /notifications/mark-read/:clientId - Mark all messages from a client as read
// ============================================================================

router.patch('/mark-read/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { clientId } = req.params;

    await query(
      `UPDATE routine_notes 
       SET read_status = true 
       WHERE professional_id = $1 AND client_id = $2 AND read_status = false`,
      [professionalId, clientId]
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read',
    });
  }
});

// ============================================================================
// GET /notifications/messages/:clientId - Get all messages with a specific client
// ============================================================================

router.get('/messages/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { clientId } = req.params;

    const messages = await query<RoutineNote>(
      `SELECT * FROM routine_notes 
       WHERE professional_id = $1 AND client_id = $2 AND professional_deleted = false
       ORDER BY created_at ASC`,
      [professionalId, clientId]
    );

    res.status(200).json({
      success: true,
      data: { messages: messages || [] },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
    });
  }
});

// ============================================================================
// POST /notifications/messages/:clientId - Send a message to a client
// ============================================================================

router.post('/messages/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { clientId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({
        success: false,
        error: 'Message content is required',
      });
      return;
    }

    const message = await queryOne<RoutineNote>(
      `INSERT INTO routine_notes (client_id, professional_id, content, sender_type, read_status, client_deleted, professional_deleted)
       VALUES ($1, $2, $3, 'professional', false, false, false)
       RETURNING *`,
      [clientId, professionalId, content.trim()]
    );

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
    });
  }
});

// ============================================================================
// DELETE /notifications/messages/:clientId - Soft delete all messages with a client
// ============================================================================

router.delete('/messages/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { clientId } = req.params;

    await query(
      `UPDATE routine_notes 
       SET professional_deleted = true 
       WHERE professional_id = $1 AND client_id = $2`,
      [professionalId, clientId]
    );

    res.status(200).json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
    });
  }
});

export default router;
