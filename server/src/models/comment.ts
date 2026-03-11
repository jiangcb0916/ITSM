import { query, queryOne } from '../db';
import { Comment } from '../types';

export interface CommentWithUser extends Comment {
  user_name?: string;
}

export async function createComment(
  ticketId: number,
  userId: number,
  content: string,
  isInternal = false
): Promise<Comment> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO comments (ticket_id, user_id, content, is_internal) VALUES ($1, $2, $3, $4) RETURNING *`,
    [ticketId, userId, content, isInternal]
  );
  if (!row) throw new Error('Create comment failed');
  return row as unknown as Comment;
}

export async function listCommentsByTicketId(ticketId: number, includeInternal: boolean): Promise<CommentWithUser[]> {
  const cond = includeInternal ? '1=1' : 'c.is_internal = FALSE';
  const rows = await query<Record<string, unknown>>(
    `SELECT c.*, u.name AS user_name FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.ticket_id = $1 AND ${cond}
     ORDER BY c.created_at ASC`,
    [ticketId]
  );
  return rows as unknown as CommentWithUser[];
}
