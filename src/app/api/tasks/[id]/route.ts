import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getTaskById, updateTask, reassignTask } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('admin', 'assigner', 'executor');
    const { id } = await params;
    const task = getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Check permissions: executor can only see their own tasks
    if (session.role === 'executor' && task.assigned_user_id !== session.userId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { getTaskUpdates, getTaskCategories, getUserById } = await import('@/lib/db');
    const updates = getTaskUpdates(id).map(u => ({ ...u, user: getUserById(u.user_id) ? { id: u.user_id, full_name: getUserById(u.user_id)!.full_name, username: getUserById(u.user_id)!.username, role: getUserById(u.user_id)!.role } : null }));
    const categories = getTaskCategories(id);
    const assignedUser = getUserById(task.assigned_user_id);
    const createdByUser = getUserById(task.created_by);

    return NextResponse.json({
      task: {
        ...task,
        assigned_user: assignedUser ? { id: assignedUser.id, full_name: assignedUser.full_name, username: assignedUser.username } : null,
        created_by_user: createdByUser ? { id: createdByUser.id, full_name: createdByUser.full_name, username: createdByUser.username } : null,
        categories,
        updates,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: e.message === 'No autenticado' || e.message === 'Sin permisos' ? 403 : 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('admin', 'assigner');
    const { id } = await params;
    const body = await request.json();

    const task = getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Handle reassignment
    if (body.reassign_to && body.reassign_to !== task.assigned_user_id) {
      const updated = reassignTask(id, body.reassign_to, session.userId);
      return NextResponse.json({ task: updated, success: true });
    }

    const { title, description, priority, deadline, category_ids } = body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (deadline !== undefined) updates.deadline = deadline;

    const updated = updateTask(id, updates);

    // Update categories
    if (category_ids !== undefined) {
      const { setTaskCategories } = await import('@/lib/db');
      setTaskCategories(id, category_ids);
    }

    return NextResponse.json({ task: updated, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: e.message === 'No autenticado' || e.message === 'Sin permisos' ? 403 : 500 });
  }
}
