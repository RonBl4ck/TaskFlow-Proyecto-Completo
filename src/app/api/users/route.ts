import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createUser, getAllUsers, updateUser, deleteUser, getUserById } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    await requireRole('admin', 'assigner', 'executor');
    const users = await getAllUsers();
    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');
    const body = await request.json();
    const {
      username,
      password,
      full_name,
      role,
      can_view_stats,
      show_in_stats,
      can_manage_categories,
      can_view_all_tasks,
      assignable_user_ids,
      sidebar_gif_idle,
      sidebar_gif_busy,
      sidebar_gif_done,
      exclude_sidebar_broadcast,
    } = body;

    if (!username || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    if (!['admin', 'assigner', 'executor'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const existing = await (await import('@/lib/db')).getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const user = await createUser({
      username,
      password_hash,
      full_name,
      role,
      can_view_stats: can_view_stats || false,
      show_in_stats: show_in_stats !== false,
      can_manage_categories: can_manage_categories || false,
      can_view_all_tasks: can_view_all_tasks || false,
      assignable_user_ids: assignable_user_ids || [],
      sidebar_gif_idle: sidebar_gif_idle || null,
      sidebar_gif_busy: sidebar_gif_busy || null,
      sidebar_gif_done: sidebar_gif_done || null,
      exclude_sidebar_broadcast: exclude_sidebar_broadcast || false,
      active: true,
    });

    return NextResponse.json({ user: { ...user, password_hash: '' }, success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole('admin');
    const body = await request.json();
    const {
      id,
      full_name,
      role,
      can_view_stats,
      show_in_stats,
      can_manage_categories,
      password,
      can_view_all_tasks,
      assignable_user_ids,
      sidebar_gif_idle,
      sidebar_gif_busy,
      sidebar_gif_done,
      exclude_sidebar_broadcast,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (full_name) updates.full_name = full_name;
    if (role) updates.role = role;
    if (can_manage_categories !== undefined) updates.can_manage_categories = can_manage_categories;
    if (can_view_stats !== undefined) updates.can_view_stats = can_view_stats;
    if (show_in_stats !== undefined) updates.show_in_stats = show_in_stats;
    if (can_view_all_tasks !== undefined) updates.can_view_all_tasks = can_view_all_tasks;
    if (assignable_user_ids !== undefined) updates.assignable_user_ids = assignable_user_ids;
    if (sidebar_gif_idle !== undefined) updates.sidebar_gif_idle = sidebar_gif_idle || null;
    if (sidebar_gif_busy !== undefined) updates.sidebar_gif_busy = sidebar_gif_busy || null;
    if (sidebar_gif_done !== undefined) updates.sidebar_gif_done = sidebar_gif_done || null;
    if (exclude_sidebar_broadcast !== undefined) updates.exclude_sidebar_broadcast = exclude_sidebar_broadcast;
    if (password) updates.password_hash = bcrypt.hashSync(password, 10);

    const user = await updateUser(id, updates);
    return NextResponse.json({ user: { ...user, password_hash: '' }, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}
