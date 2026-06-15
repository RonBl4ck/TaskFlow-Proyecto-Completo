import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createDocumentoFirma } from '@/lib/db';
import { StorageService } from '@/lib/gdrive';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const firmanteId = formData.get('firmanteId') as string;
    const x = parseFloat((formData.get('x') as string) || '100');
    const y = parseFloat((formData.get('y') as string) || '100');
    const ancho = parseFloat((formData.get('ancho') as string) || '150');
    const alto = parseFloat((formData.get('alto') as string) || '80');
    const paginaNum = parseInt((formData.get('paginaNum') as string) || '1');

    // Parámetros para el QR (opcionales)
    const qrXStr = formData.get('qr_x') as string | null;
    const qrYStr = formData.get('qr_y') as string | null;
    const qrAnchoStr = formData.get('qr_ancho') as string | null;
    const qrAltoStr = formData.get('qr_alto') as string | null;
    const qrPaginaNumStr = formData.get('qr_pagina_num') as string | null;

    const qrX = qrXStr ? parseFloat(qrXStr) : null;
    const qrY = qrYStr ? parseFloat(qrYStr) : null;
    const qrAncho = qrAnchoStr ? parseFloat(qrAnchoStr) : 70; // 70 por defecto para QR
    const qrAlto = qrAltoStr ? parseFloat(qrAltoStr) : 70;
    const qrPaginaNum = qrPaginaNumStr ? parseInt(qrPaginaNumStr) : paginaNum;

    if (!file) {
      return NextResponse.json({ error: 'No se subio ningun archivo PDF.' }, { status: 400 });
    }

    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'El archivo debe ser un PDF.' }, { status: 400 });
    }

    if (!firmanteId) {
      return NextResponse.json({ error: 'Se requiere especificar el firmante del documento.' }, { status: 400 });
    }

    console.log(
      `Solicitando firma para ${file.name}; firmante=${firmanteId}; coords=(${x}, ${y}); pagina=${paginaNum}; QR coords=(${qrX}, ${qrY})`
    );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let storedFile;
    try {
      storedFile = await StorageService.upload('entrada', file.name, buffer);
    } catch (storageError: any) {
      console.error('Error subiendo PDF para solicitud de firma:', storageError);
      return NextResponse.json({
        error: storageError.message || 'No se pudo subir el documento al almacenamiento configurado.',
      }, { status: 500 });
    }

    let doc;
    try {
      doc = await createDocumentoFirma({
        nombre_archivo: file.name,
        gdrive_file_id_temp: storedFile.fileId,
        gdrive_file_id_final: null,
        estado: 'PENDIENTE',
        x_coord: x,
        y_coord: y,
        ancho,
        alto,
        pagina_num: paginaNum,
        emisor_id: session.userId,
        firmante_id: firmanteId,
        motivo_rechazo: null,
        // Guardar parámetros del QR
        qr_x_coord: qrX,
        qr_y_coord: qrY,
        qr_ancho: qrAncho,
        qr_alto: qrAlto,
        qr_pagina_num: qrX !== null ? qrPaginaNum : null,
      } as any);
    } catch (dbError: any) {
      console.error('Error guardando solicitud de firma en Supabase:', dbError);
      return NextResponse.json({
        error: dbError.message || 'El PDF se subio, pero no se pudo registrar la solicitud en Supabase.',
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch (error: any) {
    console.error('Error en /api/firmas/solicitar:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar la solicitud' }, { status: 500 });
  }
}
