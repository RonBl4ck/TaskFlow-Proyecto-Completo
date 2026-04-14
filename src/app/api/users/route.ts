import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { createUser, getAllUsers, updateUser, deleteUser, getUserById } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    await requireRole('admin');
    const users = getAllUsers();
    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('admin');
    const body = await request.json();
    const { username, password, full_name, role, can_view_stats, can_manage_categories } = body;

    if (!username || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    if (!['admin', 'assigner', 'executor'].includes(role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const existing = (await import('@/lib/db')).getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const user = createUser({
      username,
      password_hash,
      full_name,
      role,
      can_view_stats: can_view_stats || false,
      can_manage_categories: can_manage_categories || false,
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
    const { id, full_name, role, can_view_stats, can_manage_categories, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (full_name) updates.full_name = full_name;
    if (role) updates.role = role;
    if (can_view_stats !== undefined) updates.can_view_stats = can_view_stats;
    if (can_manage_categories !== undefined) updates.can_manage_categories = can_manage_categories;
    if (password) updates.password_hash = bcrypt.hashSync(password, 10);

    const user = updateUser(id, updates);
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

    deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}
