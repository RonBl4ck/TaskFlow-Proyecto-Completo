import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByUsername } from '@/lib/db';
import { createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos' }, { status: 400 });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: 'Usuario desactivado' }, { status: 403 });
    }

    const token = await createToken({
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      canViewStats: user.can_view_stats,
      canManageCategories: user.can_manage_categories,
      canViewAllTasks: user.can_view_all_tasks || false,
      assignableUserIds: user.assignable_user_ids || [],
      sidebarGifIdle: user.sidebar_gif_idle || null,
      sidebarGifBusy: user.sidebar_gif_busy || null,
      sidebarGifDone: user.sidebar_gif_done || null,
      excludeSidebarBroadcast: user.exclude_sidebar_broadcast || false,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        canViewStats: user.can_view_stats,
        canManageCategories: user.can_manage_categories,
        canViewAllTasks: user.can_view_all_tasks || false,
        assignableUserIds: user.assignable_user_ids || [],
        sidebarGifIdle: user.sidebar_gif_idle || null,
        sidebarGifBusy: user.sidebar_gif_busy || null,
        sidebarGifDone: user.sidebar_gif_done || null,
        excludeSidebarBroadcast: user.exclude_sidebar_broadcast || false,
      },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
