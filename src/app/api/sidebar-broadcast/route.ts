import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { getActiveSidebarBroadcast, getLatestSidebarBroadcast, upsertSidebarBroadcast } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    if (searchParams.get('mode') === 'admin') {
      if (session.role !== 'admin') {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
      }

      const latest = await getLatestSidebarBroadcast();
      return NextResponse.json({ broadcast: latest });
    }

    const broadcast = await getActiveSidebarBroadcast();

    if (!broadcast || !broadcast.active) {
      return NextResponse.json({ broadcast: null });
    }

    if (
      session.excludeSidebarBroadcast ||
      (broadcast.excluded_user_ids || []).includes(session.userId)
    ) {
      return NextResponse.json({ broadcast: null });
    }

    return NextResponse.json({ broadcast });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole('admin');
    const body = await request.json();
    const latest = await getLatestSidebarBroadcast();

    const saved = await upsertSidebarBroadcast({
      id: latest?.id || 'global-sidebar-broadcast',
      message: body.message || '',
      gif_url: body.gif_url || null,
      active: body.active || false,
      excluded_user_ids: body.excluded_user_ids || [],
      created_by: session.userId,
    });

    return NextResponse.json({ broadcast: saved, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}
