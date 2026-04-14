import { User, Task, TaskUpdate, Category, TaskCategory } from './types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');

interface Database {
  users: User[];
  tasks: Task[];
  task_updates: TaskUpdate[];
  categories: Category[];
  task_categories: TaskCategory[];
}

const DEFAULT_DB: Database = {
  users: [
    {
      id: 'admin-001',
      username: 'admin',
      password_hash: bcrypt.hashSync('admin123', 10),
      full_name: 'Administrador',
      role: 'admin',
      can_view_stats: true,
      can_manage_categories: true,
      can_view_all_tasks: true,
      assignable_user_ids: [],
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'assigner-001',
      username: 'jefe',
      password_hash: bcrypt.hashSync('jefe123', 10),
      full_name: 'Carlos Jefe',
      role: 'assigner',
      can_view_stats: true,
      can_manage_categories: true,
      can_view_all_tasks: true,
      assignable_user_ids: [],
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'executor-001',
      username: 'maria',
      password_hash: bcrypt.hashSync('maria123', 10),
      full_name: 'María Ejecutora',
      role: 'executor',
      can_view_stats: false,
      can_manage_categories: false,
      can_view_all_tasks: false,
      assignable_user_ids: [],
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'executor-002',
      username: 'pedro',
      password_hash: bcrypt.hashSync('pedro123', 10),
      full_name: 'Pedro Ejecutor',
      role: 'executor',
      can_view_stats: false,
      can_manage_categories: false,
      can_view_all_tasks: false,
      assignable_user_ids: [],
      active: true,
      created_at: new Date().toISOString(),
    },
  ],
  tasks: [],
  task_updates: [],
  categories: [
    {
      id: 'cat-001',
      name: 'Desarrollo',
      parent_id: null,
      created_by: 'admin-001',
      creation_date: new Date().toISOString(),
      active: true,
    },
    {
      id: 'cat-002',
      name: 'Frontend',
      parent_id: 'cat-001',
      created_by: 'admin-001',
      creation_date: new Date().toISOString(),
      active: true,
    },
    {
      id: 'cat-003',
      name: 'Backend',
      parent_id: 'cat-001',
      created_by: 'admin-001',
      creation_date: new Date().toISOString(),
      active: true,
    },
    {
      id: 'cat-004',
      name: 'Diseño',
      parent_id: null,
      created_by: 'admin-001',
      creation_date: new Date().toISOString(),
      active: true,
    },
    {
      id: 'cat-005',
      name: 'UI',
      parent_id: 'cat-004',
      created_by: 'admin-001',
      creation_date: new Date().toISOString(),
      active: true,
    },
    {
      id: 'cat-006',
      name: 'UX',
      parent_id: 'cat-004',
      created_by: 'admin-001',
      creation_date: new Date().toISOString(),
      active: true,
    },
    {
      id: 'cat-007',
      name: 'Soporte',
      parent_id: null,
      created_by: 'admin-001',
      creation_date: new Date().toISOString(),
      active: true,
    },
  ],
  task_categories: [],
};

let db: Database;

function loadData(): Database {
  const dbPath = path.join(DATA_DIR, 'db.json');
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading DB, using defaults:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function saveData(): void {
  const dbPath = path.join(DATA_DIR, 'db.json');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Error saving DB:', e);
  }
}

// Initialize DB
db = loadData();

// ============ USERS ============

export function getUserByUsername(username: string): User | undefined {
  return db.users.find(u => u.username === username && u.active);
}

export function getUserById(id: string): User | undefined {
  return db.users.find(u => u.id === id);
}

export function getAllUsers(): User[] {
  return db.users.filter(u => u.active).map(u => ({
    ...u,
    password_hash: '',
  }));
}

export function getExecutors(): User[] {
  return db.users.filter(u => u.role === 'executor' && u.active).map(u => ({
    ...u,
    password_hash: '',
  }));
}

export function getAssignersAndAdmins(): User[] {
  return db.users.filter(u => (u.role === 'assigner' || u.role === 'admin') && u.active).map(u => ({
    ...u,
    password_hash: '',
  }));
}

export function createUser(data: Omit<User, 'id' | 'created_at'>): User {
  const user: User = {
    ...data,
    id: uuidv4(),
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  saveData();
  return user;
}

export function updateUser(id: string, data: Partial<User>): User | null {
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...data };
  saveData();
  return db.users[idx];
}

export function deleteUser(id: string): boolean {
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  db.users[idx].active = false;
  saveData();
  return true;
}

// ============ TASKS ============

export function createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'closed_at'>): Task {
  const task: Task = {
    ...data,
    id: uuidv4(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: null,
  };
  db.tasks.push(task);
  saveData();
  return task;
}

export function getTaskById(id: string): Task | undefined {
  return db.tasks.find(t => t.id === id);
}

export function getTasksByAssignee(userId: string): Task[] {
  return db.tasks.filter(t => t.assigned_user_id === userId);
}

export function getAllTasks(): Task[] {
  return [...db.tasks];
}

export function updateTask(id: string, data: Partial<Task>): Task | null {
  const idx = db.tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  db.tasks[idx] = { ...db.tasks[idx], ...data, updated_at: new Date().toISOString() };
  saveData();
  return db.tasks[idx];
}

export function reassignTask(taskId: string, newUserId: string, reassignedBy: string): Task | null {
  const idx = db.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  const oldUserId = db.tasks[idx].assigned_user_id;
  db.tasks[idx].assigned_user_id = newUserId;
  db.tasks[idx].updated_at = new Date().toISOString();
  // Create system update
  createTaskUpdate({
    task_id: taskId,
    user_id: reassignedBy,
    comment: `Tarea reasignada de ${getUserById(oldUserId)?.full_name || 'Desconocido'} a ${getUserById(newUserId)?.full_name || 'Desconocido'}`,
    hours_spent: 0,
    time_type: null,
    attachment_url: null,
    attachment_expires_at: null,
    is_system: true,
  });
  saveData();
  return db.tasks[idx];
}

// ============ TASK UPDATES ============

export function createTaskUpdate(data: Omit<TaskUpdate, 'id' | 'timestamp' | 'deleted'>): TaskUpdate {
  const update: TaskUpdate = {
    ...data,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    deleted: false,
  };
  db.task_updates.push(update);
  // Also update the task's updated_at
  const taskIdx = db.tasks.findIndex(t => t.id === data.task_id);
  if (taskIdx !== -1) {
    db.tasks[taskIdx].updated_at = new Date().toISOString();
  }
  saveData();
  return update;
}

export function getTaskUpdates(taskId: string): TaskUpdate[] {
  return db.task_updates
    .filter(u => u.task_id === taskId && !u.deleted)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function softDeleteUpdate(updateId: string): boolean {
  const idx = db.task_updates.findIndex(u => u.id === updateId);
  if (idx === -1) return false;
  db.task_updates[idx].deleted = true;
  saveData();
  return true;
}

// ============ CATEGORIES ============

export function getAllCategories(): Category[] {
  return db.categories.filter(c => c.active).sort((a, b) => {
    if (a.parent_id && !b.parent_id) return 1;
    if (!a.parent_id && b.parent_id) return -1;
    return a.name.localeCompare(b.name);
  });
}

export function getCategoryById(id: string): Category | undefined {
  return db.categories.find(c => c.id === id && c.active);
}

export function createCategory(data: Omit<Category, 'id' | 'creation_date'>): Category {
  const category: Category = {
    ...data,
    id: uuidv4(),
    creation_date: new Date().toISOString(),
  };
  db.categories.push(category);
  saveData();
  return category;
}

export function updateCategory(id: string, data: Partial<Category>): Category | null {
  const idx = db.categories.findIndex(c => c.id === id);
  if (idx === -1) return null;
  db.categories[idx] = { ...db.categories[idx], ...data };
  saveData();
  return db.categories[idx];
}

export function deleteCategory(id: string): boolean {
  const idx = db.categories.findIndex(c => c.id === id);
  if (idx === -1) return false;
  db.categories[idx].active = false;
  // Also remove task_category associations
  db.task_categories = db.task_categories.filter(tc => tc.category_id !== id);
  saveData();
  return true;
}

// ============ TASK CATEGORIES ============

export function setTaskCategories(taskId: string, categoryIds: string[]): void {
  db.task_categories = db.task_categories.filter(tc => tc.task_id !== taskId);
  for (const catId of categoryIds) {
    db.task_categories.push({ task_id: taskId, category_id: catId });
  }
  saveData();
}

export function getTaskCategories(taskId: string): Category[] {
  const catIds = db.task_categories.filter(tc => tc.task_id === taskId).map(tc => tc.category_id);
  return db.categories.filter(c => catIds.includes(c.id) && c.active);
}

// ============ STATISTICS ============

export function getStatsOverview(): {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  waitingApprovalTasks: number;
  closedTasks: number;
  rejectedTasks: number;
  totalHours: number;
  officeHours: number;
  outsideHours: number;
} {
  const updates = db.task_updates.filter(u => !u.deleted && !u.is_system);
  const totalHours = updates.reduce((sum, u) => sum + (u.hours_spent || 0), 0);
  const officeHours = updates.filter(u => u.time_type === 'office').reduce((sum, u) => sum + (u.hours_spent || 0), 0);
  const outsideHours = updates.filter(u => u.time_type === 'outside').reduce((sum, u) => sum + (u.hours_spent || 0), 0);

  // Count active days (days with at least one update)
  const activeDays = new Set(updates.map(u => u.timestamp.split('T')[0])).size;
  const avgHoursPerDay = activeDays > 0 ? totalHours / activeDays : 0;

  return {
    totalTasks: db.tasks.length,
    pendingTasks: db.tasks.filter(t => t.status === 'pending').length,
    inProgressTasks: db.tasks.filter(t => t.status === 'in_progress').length,
    waitingApprovalTasks: db.tasks.filter(t => t.status === 'waiting_approval').length,
    closedTasks: db.tasks.filter(t => t.status === 'closed').length,
    rejectedTasks: db.tasks.filter(t => t.status === 'rejected').length,
    totalHours: Math.round(totalHours * 100) / 100,
    officeHours: Math.round(officeHours * 100) / 100,
    outsideHours: Math.round(outsideHours * 100) / 100,
  };
}

export function getCategoryStats(): { category_id: string; category_name: string; hours_spent: number; tasks_closed: number }[] {
  const allCats = getAllCategories();
  return allCats.map(cat => {
    const taskIds = db.task_categories.filter(tc => tc.category_id === cat.id).map(tc => tc.task_id);
    const updates = db.task_updates.filter(u => taskIds.includes(u.task_id) && !u.deleted && !u.is_system);
    const hours = updates.reduce((sum, u) => sum + (u.hours_spent || 0), 0);
    const closed = db.tasks.filter(t => taskIds.includes(t.id) && t.status === 'closed').length;
    return { category_id: cat.id, category_name: cat.name, hours_spent: Math.round(hours * 100) / 100, tasks_closed: closed };
  }).filter(c => c.hours_spent > 0 || c.tasks_closed > 0);
}

export function getUserStatsAll(): { user_id: string; full_name: string; total_hours: number; office_hours: number; outside_hours: number; tasks_completed: number; avg_hours_per_task: number }[] {
  const users = getAllUsers().filter(u => u.role === 'executor');
  return users.map(user => {
    const userTaskIds = db.tasks.filter(t => t.assigned_user_id === user.id).map(t => t.id);
    const updates = db.task_updates.filter(u => u.user_id === user.id && !u.deleted && !u.is_system);
    const totalHours = updates.reduce((sum, u) => sum + (u.hours_spent || 0), 0);
    const officeHours = updates.filter(u => u.time_type === 'office').reduce((sum, u) => sum + (u.hours_spent || 0), 0);
    const outsideHours = updates.filter(u => u.time_type === 'outside').reduce((sum, u) => sum + (u.hours_spent || 0), 0);
    const completed = db.tasks.filter(t => t.assigned_user_id === user.id && t.status === 'closed').length;
    const avgPerTask = completed > 0 ? totalHours / completed : 0;
    return {
      user_id: user.id,
      full_name: user.full_name,
      total_hours: Math.round(totalHours * 100) / 100,
      office_hours: Math.round(officeHours * 100) / 100,
      outside_hours: Math.round(outsideHours * 100) / 100,
      tasks_completed: completed,
      avg_hours_per_task: Math.round(avgPerTask * 100) / 100,
    };
  });
}

export function getIndividualUserStats(userId: string): {
  daily: { date: string; hours: number }[];
  weekly: { week: string; hours: number }[];
  byCategory: { category_name: string; hours: number }[];
} {
  const updates = db.task_updates.filter(u => u.user_id === userId && !u.deleted && !u.is_system);

  // Daily hours
  const dailyMap = new Map<string, number>();
  updates.forEach(u => {
    const date = u.timestamp.split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + (u.hours_spent || 0));
  });
  const daily = Array.from(dailyMap.entries()).map(([date, hours]) => ({ date, hours: Math.round(hours * 100) / 100 })).sort((a, b) => a.date.localeCompare(b.date));

  // Weekly hours
  const weeklyMap = new Map<string, number>();
  updates.forEach(u => {
    const d = new Date(u.timestamp);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + (u.hours_spent || 0));
  });
  const weekly = Array.from(weeklyMap.entries()).map(([week, hours]) => ({ week, hours: Math.round(hours * 100) / 100 })).sort((a, b) => a.week.localeCompare(b.week));

  // By category
  const userTaskIds = db.tasks.filter(t => t.assigned_user_id === userId).map(t => t.id);
  const catHoursMap = new Map<string, number>();
  updates.forEach(u => {
    const tcs = db.task_categories.filter(tc => tc.task_id === u.task_id);
    tcs.forEach(tc => {
      const cat = getCategoryById(tc.category_id);
      if (cat) {
        catHoursMap.set(cat.name, (catHoursMap.get(cat.name) || 0) + (u.hours_spent || 0));
      }
    });
  });
  const byCategory = Array.from(catHoursMap.entries()).map(([category_name, hours]) => ({ category_name, hours: Math.round(hours * 100) / 100 }));

  return { daily, weekly, byCategory };
}

export function getUnreadCount(userId: string): number {
  const userTasks = db.tasks.filter(t => t.assigned_user_id === userId && t.status !== 'closed');
  let count = 0;
  userTasks.forEach(task => {
    const updates = db.task_updates.filter(u => u.task_id === task.id && !u.deleted);
    if (updates.length > 0) {
      const lastUpdate = updates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (lastUpdate.user_id !== userId) {
        count++;
      }
    }
  });
  return count;
}

export function resetDatabase(): void {
  db = JSON.parse(JSON.stringify(DEFAULT_DB));
  saveData();
}
