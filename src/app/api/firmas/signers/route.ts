import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSigners } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    console.log("👥 Listando firmantes autorizados del sistema...");
    const signers = await getSigners();
    
    return NextResponse.json({ success: true, signers });
  } catch (error: any) {
    console.error("❌ Error en /api/firmas/signers:", error);
    return NextResponse.json({ error: error.message || 'Error al listar firmantes' }, { status: 500 });
  }
}
