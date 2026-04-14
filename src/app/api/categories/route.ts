import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireRole('admin', 'assigner', 'executor');
    const categories = getAllCategories();
    return NextResponse.json({ categories });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'assigner');
    if (session.role === 'assigner' && !session.canManageCategories) {
      return NextResponse.json({ error: 'No tienes permiso para gestionar categorías' }, { status: 403 });
    }

    const body = await request.json();
    const { name, parent_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const category = createCategory({
      name,
      parent_id: parent_id || null,
      created_by: session.userId,
      active: true,
    });

    return NextResponse.json({ category, success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'assigner');
    if (session.role === 'assigner' && !session.canManageCategories) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, parent_id, active } = body;

    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (parent_id !== undefined) updates.parent_id = parent_id;
    if (active !== undefined) updates.active = active;

    const category = updateCategory(id, updates);
    return NextResponse.json({ category, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole('admin', 'assigner');
    if (session.role === 'assigner' && !session.canManageCategories) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    deleteCategory(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 403 });
  }
}
