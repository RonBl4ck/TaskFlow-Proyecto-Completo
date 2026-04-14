import { TaskStatus, TaskPriority, TimeType, UserRole } from './types';

export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    waiting_approval: 'Espera Confirmación',
    closed: 'Cerrada',
    rejected: 'Rechazada',
  };
  return labels[status];
}

export function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
    waiting_approval: 'bg-orange-100 text-orange-800 border-orange-300',
    closed: 'bg-green-100 text-green-800 border-green-300',
    rejected: 'bg-red-100 text-red-800 border-red-300',
  };
  return colors[status];
}

export function getStatusDot(status: TaskStatus): string {
  const dots: Record<TaskStatus, string> = {
    pending: 'bg-yellow-500',
    in_progress: 'bg-blue-500',
    waiting_approval: 'bg-orange-500',
    closed: 'bg-green-500',
    rejected: 'bg-red-500',
  };
  return dots[status];
}

export function getPriorityLabel(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    urgent: 'Urgente',
    high: 'Alta',
    normal: 'Normal',
    low: 'Baja',
  };
  return labels[priority];
}

export function getPriorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-400',
    high: 'bg-amber-100 text-amber-800 border-amber-400',
    normal: 'bg-green-100 text-green-800 border-green-400',
    low: 'bg-gray-100 text-gray-600 border-gray-300',
  };
  return colors[priority];
}

export function getPriorityIcon(priority: TaskPriority): string {
  const icons: Record<TaskPriority, string> = {
    urgent: '🔴',
    high: '🟡',
    normal: '🟢',
    low: '⚪',
  };
  return icons[priority];
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    assigner: 'Asignador',
    executor: 'Ejecutor',
  };
  return labels[role];
}

export function getTimeTypeLabel(type: TimeType): string {
  return type === 'office' ? 'Oficina' : 'Fuera de Oficina';
}

export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTimerTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function getDeadlineStatus(deadline: string | null): { label: string; color: string } {
  if (!deadline) return { label: 'Sin fecha límite', color: 'text-gray-400' };
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)} días vencida`, color: 'text-red-600 font-semibold' };
  if (diffDays === 0) return { label: 'Vence hoy', color: 'text-orange-600 font-semibold' };
  if (diffDays <= 3) return { label: `Vence en ${diffDays} días`, color: 'text-orange-500' };
  return { label: `Vence en ${diffDays} días`, color: 'text-green-600' };
}

export function getWeTransferExpiry(createdAt: string): { label: string; color: string; isExpired: boolean } {
  const created = new Date(createdAt);
  const expiry = new Date(created.getTime() + 3 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) return { label: 'Link expirado', color: 'text-gray-400 line-through', isExpired: true };
  if (diffHours < 24) return { label: `Expira en ${diffHours}h`, color: 'text-red-600 font-semibold', isExpired: false };
  const diffDays = Math.floor(diffHours / 24);
  const remainHours = diffHours % 24;
  return { label: `Expira en ${diffDays}d ${remainHours}h`, color: 'text-orange-500', isExpired: false };
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const STATUS_ORDER: Record<TaskStatus, number> = {
  waiting_approval: 0,
  in_progress: 1,
  pending: 2,
  rejected: 3,
  closed: 4,
};
