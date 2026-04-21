import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getTaskById, updateTask, createTaskUpdate } from '@/lib/db';



export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('admin', 'assigner', 'executor');
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const task = await getTaskById(id);
    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const isCreator = task.created_by === session.userId;

    // Assigned user requests closure
    if (action === 'request_closure' && (task.assigned_user_id === session.userId || session.role === 'admin')) {
      if (task.status !== 'in_progress' && task.status !== 'pending') {
        return NextResponse.json({ error: 'Solo se puede solicitar cierre de tareas en progreso o pendientes' }, { status: 400 });
      }

      if (isCreator && task.assigned_user_id === session.userId) {
        const updated = await updateTask(id, { status: 'closed', closed_at: new Date().toISOString() });
        await createTaskUpdate({
          task_id: id,
          user_id: session.userId,
          comment: 'Cerró la tarea (autoasignación)',
          hours_spent: 0,
          time_type: null,
          attachment_url: null,
          attachment_expires_at: null,
          is_system: true,
        });
        return NextResponse.json({ task: updated, success: true });
      }

      const updated = await updateTask(id, { status: 'waiting_approval' });
      await createTaskUpdate({
        task_id: id,
        user_id: session.userId,
        comment: 'Solicitó cierre de tarea',
        hours_spent: 0,
        time_type: null,
        attachment_url: null,
        attachment_expires_at: null,
        is_system: true,
      });
      return NextResponse.json({ task: updated, success: true });
    }

    // Assigner/Admin approves closure
    if (action === 'approve' && (session.role === 'admin' || isCreator)) {
      if (task.status !== 'waiting_approval') {
        return NextResponse.json({ error: 'Solo se pueden aprobar tareas en espera de confirmación' }, { status: 400 });
      }
      const updated = await updateTask(id, { status: 'closed', closed_at: new Date().toISOString() });
      await createTaskUpdate({
        task_id: id,
        user_id: session.userId,
        comment: 'Aprobó el cierre de la tarea',
        hours_spent: 0,
        time_type: null,
        attachment_url: null,
        attachment_expires_at: null,
        is_system: true,
      });
      return NextResponse.json({ task: updated, success: true });
    }

    // Assigner/Admin rejects closure
    if (action === 'reject' && (session.role === 'admin' || isCreator)) {
      if (task.status !== 'waiting_approval') {
        return NextResponse.json({ error: 'Solo se pueden rechazar tareas en espera de confirmación' }, { status: 400 });
      }
      const updated = await updateTask(id, { status: 'in_progress' });
      await createTaskUpdate({
        task_id: id,
        user_id: session.userId,
        comment: 'Rechazó el cierre de la tarea',
        hours_spent: 0,
        time_type: null,
        attachment_url: null,
        attachment_expires_at: null,
        is_system: true,
      });
      return NextResponse.json({ task: updated, success: true });
    }

    // Admin/Creator reopens task
    if (action === 'reopen' && (session.role === 'admin' || isCreator)) {
      if (task.status !== 'closed') {
        return NextResponse.json({ error: 'Solo se pueden reabrir tareas cerradas' }, { status: 400 });
      }
      const updated = await updateTask(id, { status: 'in_progress', closed_at: null });
      await createTaskUpdate({
        task_id: id,
        user_id: session.userId,
        comment: 'Reabrió la tarea',
        hours_spent: 0,
        time_type: null,
        attachment_url: null,
        attachment_expires_at: null,
        is_system: true,
      });
      return NextResponse.json({ task: updated, success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: 500 });
  }
}
