import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getTaskById, updateTask, reassignTask, deleteTask } from '@/lib/db';

function canManageDelegatedTask(session: { role: string; userId: string; assignableUserIds?: string[] }, task: { created_by: string; assigned_user_id: string }) {
  return session.role === 'executor' &&
    task.created_by === session.userId &&
    (session.assignableUserIds || []).includes(task.assigned_user_id);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('admin', 'assigner', 'executor');
    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const delegatedManager = canManageDelegatedTask(session, task);

    // Check permissions: executor can only see their own tasks or delegated tasks they created.
    if (session.role === 'executor' && task.assigned_user_id !== session.userId && !delegatedManager) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { getTaskUpdates, getTaskCategories, getUserById } = await import('@/lib/db');
    const updatesRaw = await getTaskUpdates(id);
    const updates = await Promise.all(updatesRaw.map(async u => {
      const uUser = await getUserById(u.user_id);
      return { ...u, user: uUser ? { id: u.user_id, full_name: uUser.full_name, username: uUser.username, role: uUser.role } : null };
    }));
    
    const categories = await getTaskCategories(id);
    const assignedUser = await getUserById(task.assigned_user_id);
    const createdByUser = await getUserById(task.created_by);

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
    const session = await requireRole('admin', 'assigner', 'executor');
    const { id } = await params;
    const body = await request.json();

    const task = await getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const delegatedManager = canManageDelegatedTask(session, task);
    if (session.role === 'executor' && !delegatedManager) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Handle reassignment
    if (body.reassign_to && body.reassign_to !== task.assigned_user_id) {
      if (session.role === 'executor' && !(session.assignableUserIds || []).includes(body.reassign_to)) {
        return NextResponse.json({ error: 'No tienes permiso para reasignar a este usuario' }, { status: 403 });
      }
      const updated = await reassignTask(id, body.reassign_to, session.userId);
      return NextResponse.json({ task: updated, success: true });
    }

    const { title, description, priority, deadline, category_ids } = body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (deadline !== undefined) updates.deadline = deadline;

    const updated = await updateTask(id, updates);

    // Update categories
    if (category_ids !== undefined) {
      const { setTaskCategories } = await import('@/lib/db');
      await setTaskCategories(id, category_ids);
    }

    return NextResponse.json({ task: updated, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: e.message === 'No autenticado' || e.message === 'Sin permisos' ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin');
    const { id } = await params;

    const task = await getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const deleted = await deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ error: 'No se pudo eliminar la tarea' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: e.message === 'No autenticado' || e.message === 'Sin permisos' ? 403 : 500 });
  }
}
