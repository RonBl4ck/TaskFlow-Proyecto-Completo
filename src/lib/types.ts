export type UserRole = 'admin' | 'assigner' | 'executor';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  can_view_stats: boolean;
  can_manage_categories: boolean;
  can_view_all_tasks: boolean;
  assignable_user_ids: string[];
  active: boolean;
  created_at: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'waiting_approval' | 'closed' | 'rejected';
export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TimeType = 'office' | 'outside';

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_user_id: string;
  created_by: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  hours_spent: number;
  time_type: TimeType | null;
  timestamp: string;
  attachment_url: string | null;
  attachment_expires_at: string | null;
  deleted: boolean;
  is_system: boolean;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  creation_date: string;
  active: boolean;
}

export interface TaskCategory {
  task_id: string;
  category_id: string;
}

export interface TaskWithDetails extends Task {
  assigned_user?: User;
  created_by_user?: User;
  categories?: Category[];
  updates?: TaskUpdate[];
  unread_count?: number;
}

export interface TaskUpdateWithUser extends TaskUpdate {
  user?: User;
}

export interface AuthSession {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  canViewStats: boolean;
  canManageCategories: boolean;
  canViewAllTasks: boolean;
  assignableUserIds: string[];
}

export interface StatsOverview {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  waitingApprovalTasks: number;
  closedTasks: number;
  rejectedTasks: number;
  totalHours: number;
  officeHours: number;
  outsideHours: number;
  avgHoursPerDay: number;
}

export interface CategoryStats {
  category_id: string;
  category_name: string;
  hours_spent: number;
  tasks_closed: number;
}

export interface UserStats {
  user_id: string;
  full_name: string;
  total_hours: number;
  office_hours: number;
  outside_hours: number;
  tasks_completed: number;
  avg_hours_per_task: number;
}

export interface DailyStats {
  date: string;
  hours: number;
}

export interface WeeklyStats {
  week: string;
  hours: number;
}
