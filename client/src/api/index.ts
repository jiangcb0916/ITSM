import axios from 'axios';

// 直接请求后端，避免代理配置问题。生产部署时设置 REACT_APP_API_URL
const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3011/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const isLoginRequest = err.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export type TicketCategory = 'network' | 'software' | 'hardware' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'pending' | 'in_progress' | 'completed' | 'closed';

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  creator_id: number;
  assignee_id: number | null;
  creator_name?: string;
  assignee_name?: string;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  completed_at: string | null;
  deleted_by_user?: boolean;
}

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  is_internal: boolean;
  created_at: string;
  user_name?: string;
}

export interface Attachment {
  id: number;
  ticket_id: number;
  original_name: string;
  created_at: string;
  size_bytes?: number | null;
  mime_type?: string | null;
}

export type UserRole = 'user' | 'technician' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface ListUsersParams {
  limit?: number;
  offset?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface ListUsersResult {
  users: User[];
  total: number;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
}

export function listUsers(params?: ListUsersParams): Promise<ListUsersResult> {
  const q: Record<string, string> = {};
  if (params?.limit != null) q.limit = String(params.limit);
  if (params?.offset != null) q.offset = String(params.offset);
  if (params?.search) q.search = params.search;
  if (params?.role) q.role = params.role;
  if (params?.status) q.status = params.status;
  return api.get<ListUsersResult>('/users', { params: q }).then((res) => res.data);
}

export function getUser(id: number): Promise<{ user: User }> {
  return api.get<{ user: User }>(`/users/${id}`).then((res) => res.data);
}

export function updateUser(id: number, data: UpdateUserData): Promise<{ user: User }> {
  return api.patch<{ user: User }>(`/users/${id}`, data).then((res) => res.data);
}

export function setUserStatus(id: number, status: UserStatus): Promise<{ user: User }> {
  return api.patch<{ user: User }>(`/users/${id}/status`, { status }).then((res) => res.data);
}

/** 技术员列表（id, name, email），用于创建工单时的指派下拉框 */
export interface TechUser {
  id: number;
  name: string;
  email: string;
}

export function getTechs(): Promise<{ users: TechUser[] }> {
  return api.get<{ users: TechUser[] }>('/users/techs').then((res) => res.data);
}

/** 工单统计（管理员/技术员），含今日新增、平均响应时间等 */
export interface TicketStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  closed: number;
  today_count: number;
  avgResponseMinutes: number | null;
}

export function getTicketStats(): Promise<TicketStats> {
  return api.get<TicketStats>('/tickets/stats').then((res) => res.data);
}

/** 技术人员专属：当前登录技术员的指派工单完成率等（工单列表页「我的完成率」卡片） */
export interface TicketTechStatsResult {
  completionRate: number;
  completedCount: number;
  totalAssigned: number;
  todayCompleted: number;
}

export function getTicketTechStats(): Promise<TicketTechStatsResult> {
  return api.get<TicketTechStatsResult>('/tickets/tech-stats').then((res) => res.data);
}

/** 仪表盘趋势：近 N 天每日创建数、完成数 */
export interface DashboardTrendResult {
  dates: string[];
  created: number[];
  resolved: number[];
}

export function getDashboardTrend(days?: number): Promise<DashboardTrendResult> {
  const params = days != null ? { days } : {};
  return api.get<DashboardTrendResult>('/dashboard/trend', { params }).then((res) => res.data);
}

/** 技术员负载/绩效：当前指派未完成数、已完成数 */
export interface TechStatItem {
  techId: number;
  techName: string;
  assignedCount: number;
  resolvedCount: number;
}

export interface DashboardTechStatsResult {
  techs: TechStatItem[];
}

export function getDashboardTechStats(): Promise<DashboardTechStatsResult> {
  return api.get<DashboardTechStatsResult>('/dashboard/tech-stats').then((res) => res.data);
}

/** 仪表盘 SLA：达标率（%）、达标工单数、总工单数、超时工单数 */
export interface DashboardSlaResult {
  slaRate: number;
  metCount: number;
  totalCount: number;
  overdueCount: number;
}

export function getDashboardSla(): Promise<DashboardSlaResult> {
  return api.get<DashboardSlaResult>('/dashboard/sla').then((res) => res.data);
}

/** ---------- 技术人员个人仪表盘（GET /api/dashboard/tech/*，仅 technician 可调） ---------- */

export interface TechDashboardKpi {
  total: number;
  pending: number;
  in_progress: number;
  today_count: number;
  avgResponseMinutes: number | null;
  completionRate: number;
  completedCount: number;
  totalAssigned: number;
  overdueCount: number;
}

export function getTechDashboardKpi(): Promise<TechDashboardKpi> {
  return api.get<TechDashboardKpi>('/dashboard/tech/kpi').then((res) => res.data);
}

export interface TechStatusDistribution {
  pending: number;
  in_progress: number;
  completed: number;
  closed: number;
}

export function getTechStatusDistribution(): Promise<TechStatusDistribution> {
  return api.get<TechStatusDistribution>('/dashboard/tech/status-distribution').then((res) => res.data);
}

export interface TechPriorityDistribution {
  high: number;
  medium: number;
  low: number;
}

export function getTechPriorityDistribution(): Promise<TechPriorityDistribution> {
  return api.get<TechPriorityDistribution>('/dashboard/tech/priority-distribution').then((res) => res.data);
}

export function getTechDashboardTrend(days?: number): Promise<DashboardTrendResult> {
  const params = days != null ? { days } : {};
  return api.get<DashboardTrendResult>('/dashboard/tech/trend', { params }).then((res) => res.data);
}

export function getTechDashboardSla(): Promise<DashboardSlaResult> {
  return api.get<DashboardSlaResult>('/dashboard/tech/sla').then((res) => res.data);
}

/** 创建工单并上传问题截图（multipart/form-data），返回创建的工单。 */
export function createTicketWithAttachments(formData: FormData): Promise<{ ticket: Ticket }> {
  return api.post<{ ticket: Ticket }>('/tickets/with-attachments', formData).then((res) => res.data);
}

/** 用户级删除：从当前用户的工单列表中移除该工单，管理员和技术员仍可见 */
export function userDeleteTicket(id: number): Promise<{ message: string }> {
  return api.put<{ message: string }>(`/tickets/${id}/user-delete`).then((res) => res.data);
}

/** 更新工单状态（管理员/技术员） */
export function updateTicketStatus(id: number, status: TicketStatus): Promise<{ ticket: Ticket }> {
  return api.patch<{ ticket: Ticket }>(`/tickets/${id}/status`, { status }).then((res) => res.data);
}

/** 指派工单（仅管理员） */
export function assignTicket(id: number, assignee_id: number): Promise<{ ticket: Ticket & { assignee_name?: string } }> {
  return api.patch<{ ticket: Ticket & { assignee_name?: string } }>(`/tickets/${id}/assign`, { assignee_id }).then((res) => res.data);
}

/** 永久删除工单（仅管理员） */
export function deleteTicket(id: number): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/tickets/${id}`).then((res) => res.data);
}

/** 工单列表查询参数 */
export interface ListTicketsParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  search?: string;
  limit?: number;
  offset?: number;
}

/** 工单列表 */
export function listTickets(params?: ListTicketsParams): Promise<{ tickets: Ticket[]; total: number }> {
  const q: Record<string, string> = {};
  if (params?.limit != null) q.limit = String(params.limit);
  if (params?.offset != null) q.offset = String(params.offset);
  if (params?.status) q.status = params.status;
  if (params?.priority) q.priority = params.priority;
  if (params?.category) q.category = params.category;
  if (params?.search) q.search = params.search;
  return api.get<{ tickets: Ticket[]; total: number }>('/tickets', { params: q }).then((res) => res.data);
}

export interface DeleteUserOptions {
  transfer_user_id?: number | null;
}

export function deleteUser(id: number, options?: DeleteUserOptions): Promise<{ message: string }> {
  const body = options?.transfer_user_id != null ? { transfer_user_id: options.transfer_user_id } : {};
  return api.delete<{ message: string }>(`/users/${id}`, { data: body }).then((res) => res.data);
}
