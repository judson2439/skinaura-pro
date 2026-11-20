/**
 * Login-streak helpers for user_gamification.
 * Current streak is consecutive calendar days the client has signed in
 * (or opened the client portal while authenticated). Completing a routine
 * is not required.
 */

import { pool } from '../config/database.js';

export interface UserGamificationRow {
  id: string;
  user_id: string;
  points: number;
  level: string;
  current_streak: number;
  longest_streak: number;
  total_routines_completed: number;
  last_completion_date: string | null;
  last_activity_date?: string | null;
  created_at: string;
  updated_at: string;
}

function toDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

export function serializeGamification<T extends {
  last_completion_date?: unknown;
  last_activity_date?: unknown;
}>(row: T): T {
  return {
    ...row,
    last_completion_date: toDateOnly(row.last_completion_date) || null,
    last_activity_date: toDateOnly(row.last_activity_date) || null,
  };
}

export async function ensureLoginStreakColumn(): Promise<void> {
  await pool.query(`
    ALTER TABLE user_gamification
    ADD COLUMN IF NOT EXISTS last_activity_date date
  `);
}

/**
 * Record that this client is logged in today and update consecutive-day streak.
 * Same calendar day is a no-op. Yesterday continues the run. Any gap resets to 1.
 */
export async function applyLoginStreak(userId: string): Promise<UserGamificationRow> {
  const updated = await pool.query<UserGamificationRow>(
    `INSERT INTO user_gamification (
       user_id, points, level, current_streak, longest_streak,
       total_routines_completed, last_activity_date, created_at, updated_at
     ) VALUES ($1, 0, 'Bronze', 1, 1, 0, CURRENT_DATE, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       current_streak = CASE
         WHEN user_gamification.last_activity_date = CURRENT_DATE
           THEN COALESCE(user_gamification.current_streak, 0)
         WHEN user_gamification.last_activity_date = CURRENT_DATE - 1
           THEN COALESCE(user_gamification.current_streak, 0) + 1
         ELSE 1
       END,
       longest_streak = GREATEST(
         COALESCE(user_gamification.longest_streak, 0),
         CASE
           WHEN user_gamification.last_activity_date = CURRENT_DATE
             THEN COALESCE(user_gamification.current_streak, 0)
           WHEN user_gamification.last_activity_date = CURRENT_DATE - 1
             THEN COALESCE(user_gamification.current_streak, 0) + 1
           ELSE 1
         END
       ),
       last_activity_date = CURRENT_DATE,
       updated_at = NOW()
     RETURNING *`,
    [userId]
  );

  return serializeGamification(updated.rows[0]);
}
