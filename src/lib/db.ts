import { User, Task, TaskUpdate, Category, TaskCategory, SidebarBroadcast, TimeType } from './types';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// ============ USERS ============

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const { data } = await supabase.from('users').select('*').eq('username', username).eq('active', true).single();
  return data || undefined;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const { data } = await supabase.from('users').select('*').eq('id', id).single();
  return data || undefined;
}

export async function getAllUsers(): Promise<User[]> {
  const { data } = await supabase.from('users').select('*').eq('active', true);
  if (!data) return [];
  return data.map(u => ({ ...u, password_hash: '' }));
}

export async function getExecutors(): Promise<User[]> {
  const { data } = await supabase.from('users').select('*').eq('role', 'executor').eq('active', true);
  if (!data) return [];
  return data.map(u => ({ ...u, password_hash: '' }));
}

export async function getAssignersAndAdmins(): Promise<User[]> {
  const { data } = await supabase.from('users').select('*').in('role', ['assigner', 'admin']).eq('active', true);
  if (!data) return [];
  return data.map(u => ({ ...u, password_hash: '' }));
}

export async function createUser(data: Omit<User, 'id' | 'created_at'>): Promise<User> {
  const id = uuidv4();
  const { data: user, error } = await supabase.from('users').insert({ ...data, id }).select().single();
  if (error) throw new Error(error.message);
  return user;
}

export async function updateUser(id: string, data: Partial<User>): Promise<User | null> {
  const { data: user, error } = await supabase.from('users').update(data).eq('id', id).select().single();
  if (error) return null;
  return user;
}

export async function deleteUser(id: string): Promise<boolean> {
  const { error } = await supabase.from('users').update({ active: false }).eq('id', id);
  return !error;
}

// ============ SIDEBAR BROADCAST ============

export async function getActiveSidebarBroadcast(): Promise<SidebarBroadcast | null> {
  const { data, error } = await supabase
    .from('sidebar_broadcast')
    .select('*')
    .eq('active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

export async function getLatestSidebarBroadcast(): Promise<SidebarBroadcast | null> {
  const { data, error } = await supabase
    .from('sidebar_broadcast')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

export async function upsertSidebarBroadcast(data: Omit<SidebarBroadcast, 'updated_at'>): Promise<SidebarBroadcast> {
  const payload = {
    ...data,
    excluded_user_ids: data.excluded_user_ids || [],
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await supabase
    .from('sidebar_broadcast')
    .upsert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return saved;
}

// ============ TASKS ============

export async function createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'closed_at'>): Promise<Task> {
  const id = uuidv4();
  const { data: task, error } = await supabase.from('tasks').insert({ ...data, id }).select().single();
  if (error) throw new Error(error.message);
  return task;
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  const { data } = await supabase.from('tasks').select('*').eq('id', id).single();
  return data || undefined;
}

export async function getTasksByAssignee(userId: string): Promise<Task[]> {
  const { data } = await supabase.from('tasks').select('*').eq('assigned_user_id', userId);
  return data || [];
}

export async function getAllTasks(): Promise<Task[]> {
  const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error: relationsError } = await supabase.from('task_categories').delete().eq('task_id', id);
  if (relationsError) return false;

  const { error: updatesError } = await supabase.from('task_updates').delete().eq('task_id', id);
  if (updatesError) return false;

  const { error: taskError } = await supabase.from('tasks').delete().eq('id', id);
  return !taskError;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
  const { data: task, error } = await supabase.from('tasks').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return null;
  return task;
}

export async function reassignTask(taskId: string, newUserId: string, reassignedBy: string): Promise<Task | null> {
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (!task) return null;
  const oldUserId = task.assigned_user_id;

  const { data: updatedTask, error } = await supabase.from('tasks')
    .update({ assigned_user_id: newUserId, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();
    
  if (error || !updatedTask) return null;

  const oldUser = await getUserById(oldUserId);
  const newUser = await getUserById(newUserId);

  await createTaskUpdate({
    task_id: taskId,
    user_id: reassignedBy,
    comment: `Tarea reasignada de ${oldUser?.full_name || 'Desconocido'} a ${newUser?.full_name || 'Desconocido'}`,
    hours_spent: 0,
    time_type: null,
    attachment_url: null,
    attachment_expires_at: null,
    is_system: true,
  });

  return updatedTask;
}

// ============ TASK UPDATES ============

export async function createTaskUpdate(data: Omit<TaskUpdate, 'id' | 'timestamp' | 'deleted'>): Promise<TaskUpdate> {
  const id = uuidv4();
  const { data: update, error } = await supabase.from('task_updates').insert({ ...data, id }).select().single();
  if (error) throw new Error(error.message);
  
  await supabase.from('tasks').update({ updated_at: new Date().toISOString() }).eq('id', data.task_id);

  return update;
}

export async function getTaskUpdates(taskId: string): Promise<TaskUpdate[]> {
  const { data } = await supabase.from('task_updates')
    .select('*')
    .eq('task_id', taskId)
    .eq('deleted', false)
    .order('timestamp', { ascending: false });
  return data || [];
}

export async function softDeleteUpdate(updateId: string): Promise<boolean> {
  const { error } = await supabase.from('task_updates').update({ deleted: true }).eq('id', updateId);
  return !error;
}

// ============ CATEGORIES ============

function getCategoryLabel(category: Category, categories: Category[]): string {
  const name = category.name.trim();
  if (!category.parent_id) return name;

  const parent = categories.find(c => c.id === category.parent_id);
  return parent ? `${parent.name.trim()} / ${name}` : name;
}

export async function getAllCategories(): Promise<Category[]> {
  const { data } = await supabase.from('categories').select('*').eq('active', true);
  if (!data) return [];
  return data.sort((a, b) => {
    if (a.parent_id && !b.parent_id) return 1;
    if (!a.parent_id && b.parent_id) return -1;
    return a.name.localeCompare(b.name);
  });
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const { data } = await supabase.from('categories').select('*').eq('id', id).eq('active', true).single();
  return data || undefined;
}

export async function createCategory(data: Omit<Category, 'id' | 'creation_date'>): Promise<Category> {
  const id = uuidv4();
  const { data: category, error } = await supabase.from('categories').insert({ ...data, id }).select().single();
  if (error) throw new Error(error.message);
  return category;
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category | null> {
  const { data: category, error } = await supabase.from('categories').update(data).eq('id', id).select().single();
  if (error) return null;
  return category;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error: error1 } = await supabase.from('categories').update({ active: false }).eq('id', id);
  if (error1) return false;
  await supabase.from('task_categories').delete().eq('category_id', id);
  return true;
}

// ============ TASK CATEGORIES ============

export async function setTaskCategories(taskId: string, categoryIds: string[]): Promise<void> {
  await supabase.from('task_categories').delete().eq('task_id', taskId);
  if (categoryIds.length > 0) {
    const inserts = categoryIds.map(catId => ({ task_id: taskId, category_id: catId }));
    await supabase.from('task_categories').insert(inserts);
  }
}

export async function getTaskCategories(taskId: string): Promise<Category[]> {
  const { data: relations } = await supabase.from('task_categories').select('category_id').eq('task_id', taskId);
  if (!relations || relations.length === 0) return [];
  const catIds = relations.map(r => r.category_id);
  const { data: categories } = await supabase.from('categories').select('*').in('id', catIds).eq('active', true);
  return categories || [];
}

// ============ STATISTICS ============

export type StatsDateMode = 'hours_logged' | 'task_created';

export interface StatsFilters {
  startDate?: string | null;
  endDate?: string | null;
  dateMode?: StatsDateMode;
  timeType?: TimeType | null;
  parentCategoryId?: string | null;
  childCategoryName?: string | null;
  userId?: string | null;
}

type StatsTask = Pick<Task, 'id' | 'title' | 'assigned_user_id' | 'status' | 'created_at' | 'closed_at'>;
type StatsUpdate = Pick<TaskUpdate, 'task_id' | 'user_id' | 'hours_spent' | 'time_type' | 'timestamp'>;

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function dayKey(value: string | null | undefined): string {
  return String(value || '').split('T')[0];
}

function isWithinDateRange(value: string | null | undefined, filters: StatsFilters): boolean {
  const date = dayKey(value);
  if (!date) return false;
  if (filters.startDate && date < filters.startDate) return false;
  if (filters.endDate && date > filters.endDate) return false;
  return true;
}

function getChildCategories(parentId: string, categories: Category[]): Category[] {
  return categories.filter(cat => cat.parent_id === parentId);
}

function taskMatchesCategoryFilters(taskId: string, filters: StatsFilters, taskCategories: TaskCategory[], categories: Category[]): boolean {
  if (!filters.parentCategoryId && !filters.childCategoryName) return true;

  const categoryIds = taskCategories.filter(tc => tc.task_id === taskId).map(tc => tc.category_id);
  const taskCats = categoryIds.map(id => categories.find(cat => cat.id === id)).filter((cat): cat is Category => Boolean(cat));

  if (filters.parentCategoryId) {
    const hasParent = taskCats.some(cat => cat.id === filters.parentCategoryId || cat.parent_id === filters.parentCategoryId);
    if (!hasParent) return false;
  }

  if (filters.childCategoryName) {
    return taskCats.some(cat =>
      cat.parent_id &&
      cat.name === filters.childCategoryName &&
      (!filters.parentCategoryId || cat.parent_id === filters.parentCategoryId)
    );
  }

  return true;
}

function filterTasks(tasks: StatsTask[], filters: StatsFilters, taskCategories: TaskCategory[], categories: Category[]): StatsTask[] {
  return tasks.filter(task => {
    if (filters.dateMode === 'task_created' && !isWithinDateRange(task.created_at, filters)) return false;
    if (filters.userId && task.assigned_user_id !== filters.userId) return false;
    return taskMatchesCategoryFilters(task.id, filters, taskCategories, categories);
  });
}

function filterUpdates(updates: StatsUpdate[], taskIds: Set<string>, filters: StatsFilters): StatsUpdate[] {
  return updates.filter(update => {
    if (!taskIds.has(update.task_id)) return false;
    if (filters.dateMode !== 'task_created' && !isWithinDateRange(update.timestamp, filters)) return false;
    if (filters.timeType && update.time_type !== filters.timeType) return false;
    if (filters.userId && update.user_id !== filters.userId) return false;
    return true;
  });
}

function sumHours(updates: StatsUpdate[]): number {
  return roundHours(updates.reduce((sum, update) => sum + (Number(update.hours_spent) || 0), 0));
}

async function buildStatsDashboard(filters: StatsFilters = {}) {
  const normalizedFilters: StatsFilters = {
    dateMode: filters.dateMode || 'hours_logged',
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    timeType: filters.timeType || null,
    parentCategoryId: filters.parentCategoryId || null,
    childCategoryName: filters.childCategoryName || null,
    userId: filters.userId || null,
  };

  const [categories, users, taskCategoriesResult, updatesResult, tasksResult] = await Promise.all([
    getAllCategories(),
    getAllUsers(),
    supabase.from('task_categories').select('task_id, category_id'),
    supabase.from('task_updates').select('task_id, user_id, hours_spent, time_type, timestamp').eq('deleted', false).eq('is_system', false),
    supabase.from('tasks').select('id, title, assigned_user_id, status, created_at, closed_at'),
  ]);

  const taskCategories = (taskCategoriesResult.data || []) as TaskCategory[];
  const allUpdates = (updatesResult.data || []) as StatsUpdate[];
  const allTasks = (tasksResult.data || []) as StatsTask[];
  const visibleUsers = users.filter(user => user.show_in_stats !== false);
  const userById = new Map(users.map(user => [user.id, user]));
  const filteredTasks = filterTasks(allTasks, normalizedFilters, taskCategories, categories);
  const filteredTaskIds = new Set(filteredTasks.map(task => task.id));
  const filteredUpdates = filterUpdates(allUpdates, filteredTaskIds, normalizedFilters);
  const tasksWithFilteredUpdates = new Set(filteredUpdates.map(update => update.task_id));
  const countedTasks = normalizedFilters.dateMode === 'task_created' && !normalizedFilters.timeType
    ? filteredTasks
    : filteredTasks.filter(task => tasksWithFilteredUpdates.has(task.id));
  const countedTaskIds = new Set(countedTasks.map(task => task.id));

  const overview = {
    totalTasks: countedTasks.length,
    pendingTasks: countedTasks.filter(t => t.status === 'pending').length,
    inProgressTasks: countedTasks.filter(t => t.status === 'in_progress').length,
    waitingApprovalTasks: countedTasks.filter(t => t.status === 'waiting_approval').length,
    closedTasks: countedTasks.filter(t => t.status === 'closed').length,
    rejectedTasks: countedTasks.filter(t => t.status === 'rejected').length,
    totalHours: sumHours(filteredUpdates),
    officeHours: sumHours(filteredUpdates.filter(u => u.time_type === 'office')),
    outsideHours: sumHours(filteredUpdates.filter(u => u.time_type === 'outside')),
  };

  const parentCategories = categories.filter(cat => !cat.parent_id);
  const categoryStats = parentCategories.map(parent => {
    const categoryIds = new Set([parent.id, ...getChildCategories(parent.id, categories).map(cat => cat.id)]);
    const taskIds = new Set(taskCategories.filter(tc => categoryIds.has(tc.category_id)).map(tc => tc.task_id));
    const parentTasks = countedTasks.filter(task => taskIds.has(task.id));
    const parentTaskIds = new Set(parentTasks.map(task => task.id));
    const parentUpdates = filteredUpdates.filter(update => parentTaskIds.has(update.task_id));

    return {
      category_id: parent.id,
      category_name: parent.name,
      parent_category_id: null,
      parent_category_name: null,
      category_label: parent.name.trim(),
      hours_spent: sumHours(parentUpdates),
      tasks_closed: parentTasks.filter(task => task.status === 'closed').length,
    };
  }).filter(c => c.hours_spent > 0 || c.tasks_closed > 0);

  const selectedParent = normalizedFilters.parentCategoryId
    ? categories.find(cat => cat.id === normalizedFilters.parentCategoryId)
    : null;

  const childSourceCategories = selectedParent
    ? getChildCategories(selectedParent.id, categories)
    : categories.filter(cat => Boolean(cat.parent_id));

  const childCategoryStats = childSourceCategories.map(child => {
    const childTaskIds = new Set(taskCategories.filter(tc => tc.category_id === child.id).map(tc => tc.task_id));
    const childTasks = countedTasks.filter(task => childTaskIds.has(task.id));
    const childTaskIdsFiltered = new Set(childTasks.map(task => task.id));
    const childUpdates = filteredUpdates.filter(update => childTaskIdsFiltered.has(update.task_id));

    return {
      category_id: child.id,
      category_name: child.name,
      parent_category_id: child.parent_id,
      parent_category_name: categories.find(cat => cat.id === child.parent_id)?.name || null,
      category_label: selectedParent ? child.name.trim() : getCategoryLabel(child, categories),
      hours_spent: sumHours(childUpdates),
      tasks_closed: childTasks.filter(task => task.status === 'closed').length,
    };
  }).filter(c => c.hours_spent > 0 || c.tasks_closed > 0);

  const childCategoryMap = new Map<string, { category_name: string; hours_spent: number; tasks_closed: number; taskIds: Set<string> }>();
  categories.filter(cat => Boolean(cat.parent_id)).forEach(child => {
    const childTaskIds = new Set(taskCategories.filter(tc => tc.category_id === child.id).map(tc => tc.task_id));
    const childTasks = countedTasks.filter(task => childTaskIds.has(task.id));
    const childTaskIdsFiltered = new Set(childTasks.map(task => task.id));
    const childUpdates = filteredUpdates.filter(update => childTaskIdsFiltered.has(update.task_id));
    const current = childCategoryMap.get(child.name) || {
      category_name: child.name,
      hours_spent: 0,
      tasks_closed: 0,
      taskIds: new Set<string>(),
    };

    childTasks.forEach(task => current.taskIds.add(task.id));
    current.hours_spent += childUpdates.reduce((sum, update) => sum + (Number(update.hours_spent) || 0), 0);
    current.tasks_closed = Array.from(current.taskIds)
      .map(id => countedTasks.find(task => task.id === id))
      .filter((task): task is StatsTask => Boolean(task))
      .filter(task => task.status === 'closed').length;
    childCategoryMap.set(child.name, current);
  });

  const childCategoryGlobalStats = Array.from(childCategoryMap.values())
    .map(item => ({
      category_id: item.category_name,
      category_name: item.category_name,
      category_label: item.category_name,
      hours_spent: roundHours(item.hours_spent),
      tasks_closed: item.tasks_closed,
    }))
    .filter(c => c.hours_spent > 0 || c.tasks_closed > 0)
    .sort((a, b) => a.category_name.localeCompare(b.category_name));

  const userStats = visibleUsers.map(user => {
    const userUpdates = filteredUpdates.filter(update => update.user_id === user.id);
    const userTaskIds = new Set(userUpdates.map(update => update.task_id));
    const assignedClosed = countedTasks.filter(task => task.assigned_user_id === user.id && task.status === 'closed').length;
    const completed = assignedClosed || countedTasks.filter(task => userTaskIds.has(task.id) && task.status === 'closed').length;
    const totalHours = sumHours(userUpdates);
    const avgPerTask = completed > 0 ? totalHours / completed : 0;

    return {
      user_id: user.id,
      full_name: user.full_name,
      total_hours: totalHours,
      office_hours: sumHours(userUpdates.filter(update => update.time_type === 'office')),
      outside_hours: sumHours(userUpdates.filter(update => update.time_type === 'outside')),
      tasks_completed: completed,
      avg_hours_per_task: roundHours(avgPerTask),
    };
  }).filter(user => user.total_hours > 0 || user.tasks_completed > 0);

  const individualStats = normalizedFilters.userId
    ? buildIndividualStats(filteredUpdates, taskCategories, categories)
    : null;

  const taskDetails = countedTasks.map(task => {
    const taskUpdates = filteredUpdates.filter(update => update.task_id === task.id);
    const taskCats = taskCategories
      .filter(tc => tc.task_id === task.id)
      .map(tc => categories.find(cat => cat.id === tc.category_id))
      .filter((cat): cat is Category => Boolean(cat));
    const categoryLabels = taskCats.map(cat => getCategoryLabel(cat, categories));
    const durationDays = task.closed_at
      ? Math.max(0, Math.ceil((new Date(task.closed_at).getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      task_id: task.id,
      title: task.title,
      status: task.status,
      assigned_user: userById.get(task.assigned_user_id)?.full_name || 'Sin asignar',
      category_labels: categoryLabels,
      created_at: task.created_at,
      closed_at: task.closed_at,
      hours_spent: sumHours(taskUpdates),
      office_hours: sumHours(taskUpdates.filter(update => update.time_type === 'office')),
      outside_hours: sumHours(taskUpdates.filter(update => update.time_type === 'outside')),
      duration_days: durationDays,
    };
  }).sort((a, b) => b.hours_spent - a.hours_spent || a.title.localeCompare(b.title));

  return {
    overview,
    categoryStats,
    childCategoryStats,
    childCategoryGlobalStats,
    userStats,
    individualStats,
    taskDetails,
    filters: normalizedFilters,
  };
}

function buildIndividualStats(updates: StatsUpdate[], taskCategories: TaskCategory[], categories: Category[]) {
  const dailyMap = new Map<string, number>();
  updates.forEach(update => {
    const date = dayKey(update.timestamp);
    dailyMap.set(date, (dailyMap.get(date) || 0) + (Number(update.hours_spent) || 0));
  });
  const daily = Array.from(dailyMap.entries()).map(([date, hours]) => ({ date, hours: roundHours(hours) })).sort((a, b) => a.date.localeCompare(b.date));

  const weeklyMap = new Map<string, number>();
  updates.forEach(update => {
    const d = new Date(String(update.timestamp));
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + (Number(update.hours_spent) || 0));
  });
  const weekly = Array.from(weeklyMap.entries()).map(([week, hours]) => ({ week, hours: roundHours(hours) })).sort((a, b) => a.week.localeCompare(b.week));

  const catHoursMap = new Map<string, { category_name: string; category_label: string; hours: number }>();
  updates.forEach(update => {
    const taskCats = taskCategories.filter(tc => tc.task_id === update.task_id);
    taskCats.forEach(tc => {
      const cat = categories.find(c => c.id === tc.category_id);
      if (cat) {
        const current = catHoursMap.get(cat.id);
        catHoursMap.set(cat.id, {
          category_name: cat.name,
          category_label: getCategoryLabel(cat, categories),
          hours: (current?.hours || 0) + (Number(update.hours_spent) || 0),
        });
      }
    });
  });
  const byCategory = Array.from(catHoursMap.entries()).map(([category_id, data]) => ({
    category_id,
    category_name: data.category_name,
    category_label: data.category_label,
    hours: roundHours(data.hours),
  }));

  return { daily, weekly, byCategory };
}

export async function getStatsDashboard(filters: StatsFilters = {}) {
  return buildStatsDashboard(filters);
}

export async function getStatsOverview(filters: StatsFilters = {}): Promise<any> {
  return (await buildStatsDashboard(filters)).overview;
}

export async function getCategoryStats(filters: StatsFilters = {}): Promise<any[]> {
  return (await buildStatsDashboard(filters)).categoryStats;
}

export async function getUserStatsAll(filters: StatsFilters = {}): Promise<any[]> {
  return (await buildStatsDashboard(filters)).userStats;
}

export async function getIndividualUserStats(userId: string, filters: StatsFilters = {}): Promise<any> {
  return (await buildStatsDashboard({ ...filters, userId })).individualStats;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { data: tasks } = await supabase.from('tasks').select('id, status').eq('assigned_user_id', userId).neq('status', 'closed');
  if (!tasks) return 0;
  
  let count = 0;
  for (const task of tasks) {
    const { data: updates } = await supabase.from('task_updates').select('user_id, timestamp').eq('task_id', task.id).eq('deleted', false).order('timestamp', { ascending: false }).limit(1);
    if (updates && updates.length > 0) {
      if (updates[0].user_id !== userId) {
        count++;
      }
    }
  }
  return count;
}
