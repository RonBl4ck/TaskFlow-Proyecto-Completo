import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getStatsDashboard, StatsDateMode } from '@/lib/db';
import { TimeType } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'assigner');
    if (!session.canViewStats && session.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permiso para ver estadísticas' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const dateMode = searchParams.get('dateMode') === 'task_created' ? 'task_created' : 'hours_logged';
    const timeTypeParam = searchParams.get('timeType');
    const timeType = timeTypeParam === 'office' || timeTypeParam === 'outside' ? timeTypeParam : null;

    const stats = await getStatsDashboard({
      userId: userId || null,
      dateMode: dateMode as StatsDateMode,
      timeType: timeType as TimeType | null,
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      parentCategoryId: searchParams.get('parentCategoryId'),
      childCategoryName: searchParams.get('childCategoryName'),
    });

    return NextResponse.json(stats);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}
