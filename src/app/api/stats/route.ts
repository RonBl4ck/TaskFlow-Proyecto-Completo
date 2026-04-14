import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getStatsOverview, getCategoryStats, getUserStatsAll, getIndividualUserStats } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'assigner');
    if (!session.canViewStats && session.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permiso para ver estadísticas' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const overview = getStatsOverview();
    const categoryStats = getCategoryStats();
    const userStats = getUserStatsAll();

    let individualStats = null;
    if (userId) {
      individualStats = getIndividualUserStats(userId);
    }

    return NextResponse.json({
      overview,
      categoryStats,
      userStats,
      individualStats,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}
