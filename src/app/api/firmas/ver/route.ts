import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { StorageService } from '@/lib/gdrive';
import { getDocumentoFirmaByStoredFile } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Autenticación requerida para ver documentos
    const session = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const folder = searchParams.get('folder') || 'entrada';

    if (!fileId) {
      return NextResponse.json({ error: 'Falta el parámetro fileId' }, { status: 400 });
    }

    if (folder !== 'entrada' && folder !== 'firmados') {
      return NextResponse.json({ error: 'Folder inválido' }, { status: 400 });
    }

    console.log(`📥 Descargando archivo con ID ${fileId} desde la carpeta ${folder} para visualización...`);
    
    const doc = await getDocumentoFirmaByStoredFile(fileId, folder as 'entrada' | 'firmados');
    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    const canView =
      session.role === 'admin' ||
      doc.emisor_id === session.userId ||
      doc.firmante_id === session.userId;

    if (!canView) {
      return NextResponse.json({ error: 'No tienes permisos para ver este documento.' }, { status: 403 });
    }

    const fileBuffer = await StorageService.download(folder as 'entrada' | 'firmados', fileId);

    // Retornar el archivo PDF directamente al navegador
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="documento-${fileId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("❌ Error en /api/firmas/ver:", error);
    return NextResponse.json({ error: error.message || 'Error al descargar el archivo' }, { status: 500 });
  }
}
