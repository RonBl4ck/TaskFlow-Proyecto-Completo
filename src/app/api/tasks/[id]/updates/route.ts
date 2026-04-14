import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createTaskUpdate, softDeleteUpdate, getTaskUpdates } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('admin', 'assigner', 'executor');
    const { id } = await params;
    const updatesRaw = await getTaskUpdates(id);
    const updates = await Promise.all(updatesRaw.map(async u => {
      const { getUserById } = require('@/lib/db');
      const user = await getUserById(u.user_id);
      return { ...u, user: user ? { id: user.id, full_name: user.full_name, username: user.username, role: user.role } : null };
    }));
    return NextResponse.json({ updates });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('admin', 'assigner', 'executor');
    const { id } = await params;
    const body = await request.json();
    const { comment, hours_spent, time_type, attachment_url } = body;

    if (!comment && hours_spent === 0 && !attachment_url) {
      return NextResponse.json({ error: 'Debes agregar un comentario, horas o un link' }, { status: 400 });
    }

    const attachment_expires_at = attachment_url ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null;

    const update = await createTaskUpdate({
      task_id: id,
      user_id: session.userId,
      comment: comment || '',
      hours_spent: hours_spent || 0,
      time_type: time_type || null,
      attachment_url: attachment_url || null,
      attachment_expires_at,
      is_system: false,
    });

    // If assigner/admin comments on in_progress task, change to pending
    if ((session.role === 'assigner' || session.role === 'admin') && comment) {
      const { getTaskById, updateTask } = await import('@/lib/db');
      const task = await getTaskById(id);
      if (task && task.status === 'in_progress') {
        await updateTask(id, { status: 'pending' });
      }
    }

    // If executor comments on pending task, change to in_progress
    if (session.role === 'executor') {
      const { getTaskById, updateTask } = await import('@/lib/db');
      const task = await getTaskById(id);
      if (task && task.status === 'pending') {
        await updateTask(id, { status: 'in_progress' });
      }
    }

    return NextResponse.json({ update, success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error en el servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('admin', 'assigner');
    const { searchParams } = new URL(request.url);
    const updateId = searchParams.get('updateId');

    if (!updateId) {
      return NextResponse.json({ error: 'updateId requerido' }, { status: 400 });
    }

    // Check if assigner has delete permission (admin always can)
    if (session.role === 'assigner') {
      const user = (await import('@/lib/db')).getUserById(session.userId);
      // We allow assigner to delete updates - you can add more checks here
    }

    await softDeleteUpdate(updateId);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
