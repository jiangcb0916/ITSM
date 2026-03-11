export type UserRole = 'user' | 'technician' | 'admin';
export type TicketCategory = 'network' | 'software' | 'hardware' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'pending' | 'in_progress' | 'completed' | 'closed';

export type UserStatus = 'active' | 'disabled';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  creator_id: number;
  assignee_id: number | null;
  created_at: Date;
  updated_at: Date;
  first_response_at: Date | null;
  completed_at: Date | null;
  /** 创建人是否从自己的列表中移除了该工单，仅影响普通用户视角 */
  deleted_by_user?: boolean;
}

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  is_internal: boolean;
  created_at: Date;
}

export interface Attachment {
  id: number;
  ticket_id: number;
  comment_id: number | null;
  uploaded_by: number;
  filename: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  path: string;
  created_at: Date;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      ticket?: Ticket;
    }
  }
}
