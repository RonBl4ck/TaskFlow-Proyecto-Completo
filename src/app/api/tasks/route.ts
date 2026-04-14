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
    if (myTasks || session.role === 'executor') {
      tasks = getTasksByAssignee(session.userId);
    } else {
      tasks = getAllTasks();
    }

    // Enrich with category info
    const { getAllCategories, getTaskCategories } = await import('@/lib/db');
    const categories = getAllCategories();

    const enriched = tasks.map(task => ({
      ...task,
      categories: getTaskCategories(task.id),
    }));

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
    const session = await requireRole('admin', 'assigner');
    const body = await request.json();
    const { title, description, assigned_user_id, status, priority, deadline, category_ids } = body;

    if (!title || !assigned_user_id) {
      return NextResponse.json({ error: 'Título y usuario asignado son requeridos' }, { status: 400 });
    }

    const task = createTask({
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
      setTaskCategories(task.id, category_ids);
    }

    return NextResponse.json({ task, success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: e.message === 'No autenticado' || e.message === 'Sin permisos' ? 403 : 500 });
  }
}
