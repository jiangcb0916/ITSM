import { query } from '../db';

export async function createNotification(
  userId: number,
  title: string,
  body: string | null,
  relatedTicketId?: number | null
): Promise<void> {
  await query(
    'INSERT INTO notifications (user_id, title, body, related_ticket_id) VALUES ($1, $2, $3, $4)',
    [userId, title, body ?? null, relatedTicketId ?? null]
  );
}

export async function getUnreadCount(userId: number): Promise<number> {
  const row = await query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [userId]
  );
  return row[0] ? parseInt(row[0].count, 10) : 0;
}
