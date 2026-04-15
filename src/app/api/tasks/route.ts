import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createTask, getAllTasks, getTasksByAssignee } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'assigner', 'executor');
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const myTasks = searchParams.get('myTasks') === 'true';

    let tasks;
    if (myTasks) {
      tasks = await getTasksByAssignee(session.userId);
    } else if (session.role === 'admin' || session.canViewAllTasks) {
      tasks = await getAllTasks();
    } else if (session.role === 'assigner') {
      const all = await getAllTasks();
      tasks = all.filter(t => t.created_by === session.userId || t.assigned_user_id === session.userId);
    } else {
      const all = await getAllTasks();
      tasks = all.filter(t =>
        t.assigned_user_id === session.userId ||
        (t.created_by === session.userId && (session.assignableUserIds || []).includes(t.assigned_user_id))
      );
    }

    // Enrich with category and user info for the UI.
    const { getTaskCategories, getUserById } = await import('@/lib/db');

    const enriched = await Promise.all(tasks.map(async task => ({
      ...task,
      categories: await getTaskCategories(task.id),
      assigned_user: await getUserById(task.assigned_user_id),
      created_by_user: await getUserById(task.created_by),
    })));

    // Sort by priority and status
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const statusOrder: Record<string, number> = { waiting_approval: 0, in_progress: 1, pending: 2, rejected: 3, closed: 4 };
    enriched.sort((a, b) => {
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return statusOrder[a.status] - statusOrder[b.status];
    });

    return NextResponse.json({ tasks: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: e.message === 'No autenticado' || e.message === 'Sin permisos' ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { requireAuth } = await import('@/lib/auth');
    const session = await requireAuth();
    const body = await request.json();
    const { title, description, assigned_user_id, status, priority, deadline, category_ids } = body;

    if (!title || !assigned_user_id) {
      return NextResponse.json({ error: 'Título y usuario asignado son requeridos' }, { status: 400 });
    }

    if (session.role === 'executor') {
      if (!session.assignableUserIds || session.assignableUserIds.length === 0) {
        return NextResponse.json({ error: 'Sin permisos para asignar tareas' }, { status: 403 });
      }
      if (!session.assignableUserIds.includes(assigned_user_id)) {
        return NextResponse.json({ error: 'No tienes permiso para asignar a este usuario' }, { status: 403 });
      }
    } else if (session.role !== 'admin' && session.role !== 'assigner') {
      return NextResponse.json({ error: 'Rol inválido para crear tareas' }, { status: 403 });
    }

    const task = await createTask({
      title,
      description: description || '',
      assigned_user_id,
      created_by: session.userId,
      status: status || 'pending',
      priority: priority || 'normal',
      deadline: deadline || null,
    });

    // Set categories
    if (category_ids && category_ids.length > 0) {
      const { setTaskCategories } = await import('@/lib/db');
      await setTaskCategories(task.id, category_ids);
    }

    return NextResponse.json({ task, success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: e.message === 'No autenticado' || e.message === 'Sin permisos' ? 403 : 500 });
  }
}
