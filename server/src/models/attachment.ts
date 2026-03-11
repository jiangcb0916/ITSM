import { query, queryOne } from '../db';
import { Attachment } from '../types';

export async function createAttachment(
  ticketId: number,
  uploadedBy: number,
  filename: string,
  originalName: string,
  path: string,
  commentId?: number | null,
  mimeType?: string | null,
  sizeBytes?: number | null
): Promise<Attachment> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO attachments (ticket_id, comment_id, uploaded_by, filename, original_name, mime_type, size_bytes, path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [ticketId, commentId ?? null, uploadedBy, filename, originalName, mimeType ?? null, sizeBytes ?? null, path]
  );
  if (!row) throw new Error('Create attachment failed');
  return row as unknown as Attachment;
}

export async function findAttachmentsByTicketId(ticketId: number): Promise<Attachment[]> {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM attachments WHERE ticket_id = $1 ORDER BY created_at ASC',
    [ticketId]
  );
  return rows as unknown as Attachment[];
}

export async function findAttachmentById(id: number): Promise<Attachment | null> {
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM attachments WHERE id = $1', [id]);
  return row as unknown as Attachment | null;
}
