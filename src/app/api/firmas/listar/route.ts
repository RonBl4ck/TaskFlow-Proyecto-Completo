import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getDocumentosFirmaByFirmante,
  getDocumentosFirmaByEmisor,
  getAllDocumentosFirma,
  getUserById,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'all' | 'firmante' | 'emisor'

    let docs = [];

    // Lógica de filtrado de documentos de acuerdo al rol del usuario
    if (session.role === 'admin') {
      if (filter === 'firmante') {
        docs = await getDocumentosFirmaByFirmante(session.userId);
      } else if (filter === 'emisor') {
        docs = await getDocumentosFirmaByEmisor(session.userId);
      } else {
        docs = await getAllDocumentosFirma();
      }
    } else {
      // Para gestores (assigners) y ejecutores (executors)
      if (filter === 'emisor') {
        docs = await getDocumentosFirmaByEmisor(session.userId);
      } else if (filter === 'firmante') {
        docs = await getDocumentosFirmaByFirmante(session.userId);
      } else {
        // Por defecto, ver tanto lo que envió como lo que tiene por firmar
        const sent = await getDocumentosFirmaByEmisor(session.userId);
        const inbox = await getDocumentosFirmaByFirmante(session.userId);
        
        // Unir y remover duplicados (si los hay)
        const combined = [...sent];
        inbox.forEach(doc => {
          if (!combined.some(c => c.id === doc.id)) {
            combined.push(doc);
          }
        });
        docs = combined.sort((a, b) => new Date(b.creado_at).getTime() - new Date(a.creado_at).getTime());
      }
    }

    // Enriquecer con la información de los usuarios Emisor y Firmante
    const enrichedDocs = await Promise.all(
      docs.map(async doc => {
        const emisor = await getUserById(doc.emisor_id);
        const firmante = await getUserById(doc.firmante_id);
        
        // Si el archivo está en local, adjuntar la URL local directa.
        // Si está en Google Drive y está firmado, el link de visualización ya está guardado o generará a través de endpoint.
        let fileUrl = '';
        if (doc.estado === 'PENDIENTE') {
          fileUrl = doc.gdrive_file_id_temp
            ? `/api/firmas/ver?fileId=${encodeURIComponent(doc.gdrive_file_id_temp)}&folder=entrada`
            : '';
        } else if (doc.estado === 'APROBADO') {
          fileUrl = doc.gdrive_file_id_final
            ? `/api/firmas/ver?fileId=${encodeURIComponent(doc.gdrive_file_id_final)}&folder=firmados`
            : '';
        }

        return {
          ...doc,
          fileUrl,
          emisor: emisor ? { id: emisor.id, username: emisor.username, fullName: emisor.full_name } : null,
          firmante: firmante ? { id: firmante.id, username: firmante.username, fullName: firmante.full_name } : null,
        };
      })
    );

    return NextResponse.json({ success: true, documents: enrichedDocs });
  } catch (error: any) {
    console.error("❌ Error en /api/firmas/listar:", error);
    return NextResponse.json({ error: error.message || 'Error al listar documentos' }, { status: 500 });
  }
}
