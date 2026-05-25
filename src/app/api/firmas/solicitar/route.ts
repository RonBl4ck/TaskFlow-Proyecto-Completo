import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createDocumentoFirma } from '@/lib/db';
import { StorageService } from '@/lib/gdrive';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    
    // Parsear FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const firmanteId = formData.get('firmanteId') as string;
    const x = parseFloat(formData.get('x') as string || '100');
    const y = parseFloat(formData.get('y') as string || '100');
    const ancho = parseFloat(formData.get('ancho') as string || '150');
    const alto = parseFloat(formData.get('alto') as string || '80');
    const paginaNum = parseInt(formData.get('paginaNum') as string || '1');

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo PDF.' }, { status: 400 });
    }

    if (!firmanteId) {
      return NextResponse.json({ error: 'Se requiere especificar el firmante del documento.' }, { status: 400 });
    }

    console.log(`📁 Solicitando firma para el archivo: ${file.name}, firmante: ${firmanteId}, coords: (${x}, ${y}), pág: ${paginaNum}`);

    // Convertir archivo a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir archivo al almacenamiento temporal (entrada)
    const storedFile = await StorageService.upload('entrada', file.name, buffer);

    // Crear registro en base de datos
    const doc = await createDocumentoFirma({
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
    });

    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch (error: any) {
    console.error("❌ Error en /api/firmas/solicitar:", error);
    return NextResponse.json({ error: error.message || 'Error al procesar la solicitud' }, { status: 500 });
  }
}
