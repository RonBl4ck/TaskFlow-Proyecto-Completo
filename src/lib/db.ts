import { User, Task, TaskUpdate, Category, TaskCategory } from './types';
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

export async function getStatsOverview(): Promise<any> {
  const { data: updates } = await supabase.from('task_updates').select('hours_spent, time_type, timestamp').eq('deleted', false).eq('is_system', false);
  const { data: tasks } = await supabase.from('tasks').select('status');
  
  const totalHours = updates?.reduce((sum, u) => sum + (Number(u.hours_spent) || 0), 0) || 0;
  const officeHours = updates?.filter(u => u.time_type === 'office').reduce((sum, u) => sum + (Number(u.hours_spent) || 0), 0) || 0;
  const outsideHours = updates?.filter(u => u.time_type === 'outside').reduce((sum, u) => sum + (Number(u.hours_spent) || 0), 0) || 0;

  return {
    totalTasks: tasks?.length || 0,
    pendingTasks: tasks?.filter(t => t.status === 'pending').length || 0,
    inProgressTasks: tasks?.filter(t => t.status === 'in_progress').length || 0,
    waitingApprovalTasks: tasks?.filter(t => t.status === 'waiting_approval').length || 0,
    closedTasks: tasks?.filter(t => t.status === 'closed').length || 0,
    rejectedTasks: tasks?.filter(t => t.status === 'rejected').length || 0,
    totalHours: Math.round(totalHours * 100) / 100,
    officeHours: Math.round(officeHours * 100) / 100,
    outsideHours: Math.round(outsideHours * 100) / 100,
  };
}

export async function getCategoryStats(): Promise<any[]> {
  const cats = await getAllCategories();
  const { data: tcs } = await supabase.from('task_categories').select('task_id, category_id');
  const { data: updates } = await supabase.from('task_updates').select('task_id, hours_spent').eq('deleted', false).eq('is_system', false);
  const { data: tasks } = await supabase.from('tasks').select('id, status');

  return cats.map(cat => {
    const taskIds = tcs?.filter(tc => tc.category_id === cat.id).map(tc => tc.task_id) || [];
    const catUpdates = updates?.filter(u => taskIds.includes(u.task_id)) || [];
    const hours = catUpdates.reduce((sum, u) => sum + (Number(u.hours_spent) || 0), 0);
    const closed = tasks?.filter(t => taskIds.includes(t.id) && t.status === 'closed').length || 0;
    
    return { category_id: cat.id, category_name: cat.name, hours_spent: Math.round(hours * 100) / 100, tasks_closed: closed };
  }).filter(c => c.hours_spent > 0 || c.tasks_closed > 0);
}

export async function getUserStatsAll(): Promise<any[]> {
  const users = await getExecutors();
  const { data: tasks } = await supabase.from('tasks').select('id, assigned_user_id, status');
  const { data: updates } = await supabase.from('task_updates').select('user_id, hours_spent, time_type').eq('deleted', false).eq('is_system', false);

  return users.map(user => {
    const userUpdates = updates?.filter(u => u.user_id === user.id) || [];
    const totalHours = userUpdates.reduce((sum, u) => sum + (Number(u.hours_spent) || 0), 0);
    const officeHours = userUpdates.filter(u => u.time_type === 'office').reduce((sum, u) => sum + (Number(u.hours_spent) || 0), 0);
    const outsideHours = userUpdates.filter(u => u.time_type === 'outside').reduce((sum, u) => sum + (Number(u.hours_spent) || 0), 0);
    const completed = tasks?.filter(t => t.assigned_user_id === user.id && t.status === 'closed').length || 0;
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

export async function getIndividualUserStats(userId: string): Promise<any> {
  const { data: updates } = await supabase.from('task_updates')
    .select('task_id, hours_spent, timestamp')
    .eq('user_id', userId)
    .eq('deleted', false)
    .eq('is_system', false);

  const { data: tcs } = await supabase.from('task_categories').select('task_id, category_id');
  const cats = await getAllCategories();

  // Daily hours
  const dailyMap = new Map<string, number>();
  updates?.forEach(u => {
    const date = String(u.timestamp).split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + (Number(u.hours_spent) || 0));
  });
  const daily = Array.from(dailyMap.entries()).map(([date, hours]) => ({ date, hours: Math.round(hours * 100) / 100 })).sort((a, b) => a.date.localeCompare(b.date));

  // Weekly hours
  const weeklyMap = new Map<string, number>();
  updates?.forEach(u => {
    const d = new Date(String(u.timestamp));
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + (Number(u.hours_spent) || 0));
  });
  const weekly = Array.from(weeklyMap.entries()).map(([week, hours]) => ({ week, hours: Math.round(hours * 100) / 100 })).sort((a, b) => a.week.localeCompare(b.week));

  // By category
  const catHoursMap = new Map<string, number>();
  updates?.forEach(u => {
    const taskCats = tcs?.filter(tc => tc.task_id === u.task_id) || [];
    taskCats.forEach(tc => {
      const cat = cats.find(c => c.id === tc.category_id);
      if (cat) {
        catHoursMap.set(cat.name, (catHoursMap.get(cat.name) || 0) + (Number(u.hours_spent) || 0));
      }
    });
  });
  const byCategory = Array.from(catHoursMap.entries()).map(([category_name, hours]) => ({ category_name, hours: Math.round(hours * 100) / 100 }));

  return { daily, weekly, byCategory };
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
