import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDocumentoFirmaById, updateDocumentoFirma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id, motivo } = body;

    if (!id || !motivo) {
      return NextResponse.json({ error: 'Se requiere el ID del documento y el motivo del rechazo.' }, { status: 400 });
    }

    // 1. Obtener la solicitud
    const doc = await getDocumentoFirmaById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    if (doc.estado !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Este documento ya ha sido procesado (aprobado o rechazado).' }, { status: 400 });
    }

    // 2. Verificar permisos
    if (doc.firmante_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos para rechazar este documento.' }, { status: 403 });
    }

    console.log(`❌ Rechazando firma del documento "${doc.nombre_archivo}", motivo: ${motivo}`);

    // 3. Actualizar base de datos
    await updateDocumentoFirma(doc.id, {
      estado: 'RECHAZADO',
      motivo_rechazo: motivo,
    });

    return NextResponse.json({ success: true, message: 'Documento rechazado con éxito.' });
  } catch (error: any) {
    console.error("❌ Error en /api/firmas/rechazar:", error);
    return NextResponse.json({ error: error.message || 'Error al rechazar el documento.' }, { status: 500 });
  }
}
