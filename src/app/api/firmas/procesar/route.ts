import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDocumentoFirmaById, updateDocumentoFirma, getUserById } from '@/lib/db';
import { StorageService } from '@/lib/gdrive';
import { PDFSigner } from '@/lib/pdfSigner';
import fs from 'fs';
import path from 'path';

// Helper para convertir el signature_image_url en un Buffer de bytes
async function getSignatureBuffer(signatureUrl: string): Promise<Buffer> {
  // Caso 1: Data URI Base64
  if (signatureUrl.startsWith('data:image/')) {
    const base64Data = signatureUrl.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  }

  // Caso 2: Ruta local (dentro de public)
  if (signatureUrl.startsWith('/')) {
    const localPath = path.join(process.cwd(), 'public', signatureUrl);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  }

  // Caso 3: URL absoluta en internet
  try {
    const res = await fetch(signatureUrl);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`❌ No se pudo descargar la firma desde la URL: ${signatureUrl}. Error:`, error);
    throw new Error('La imagen de firma del usuario no es accesible.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el ID del documento a firmar.' }, { status: 400 });
    }

    // 1. Obtener la solicitud de firma
    const doc = await getDocumentoFirmaById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 });
    }

    if (doc.estado !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Este documento ya ha sido procesado (aprobado o rechazado).' }, { status: 400 });
    }

    // 2. Verificar que el usuario actual tenga autorización
    if (doc.firmante_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'No tienes permisos para firmar este documento.' }, { status: 403 });
    }

    // 3. Obtener el usuario firmante para recuperar su imagen de firma
    const firmante = await getUserById(doc.firmante_id);
    if (!firmante) {
      return NextResponse.json({ error: 'El usuario firmante no existe en la base de datos.' }, { status: 404 });
    }

    if (!firmante.signature_image_url) {
      return NextResponse.json({
        error: 'No tienes una imagen de firma registrada en tu perfil. Súbela en el panel de Administración de usuarios para poder firmar.'
      }, { status: 400 });
    }

    console.log(`⏳ Procesando firma del documento "${doc.nombre_archivo}" por ${firmante.full_name}...`);

    // 4. Obtener Buffer de la firma PNG
    let signatureBuffer: Buffer;
    try {
      signatureBuffer = await getSignatureBuffer(firmante.signature_image_url);
    } catch (e: any) {
      return NextResponse.json({ error: `Error al obtener la imagen de la firma: ${e.message}` }, { status: 400 });
    }

    // 5. Descargar el archivo PDF temporal original (de entrada)
    if (!doc.gdrive_file_id_temp) {
      return NextResponse.json({ error: 'El archivo temporal no está registrado en la base de datos.' }, { status: 400 });
    }

    let pdfOriginalBuffer: Buffer;
    try {
      pdfOriginalBuffer = await StorageService.download('entrada', doc.gdrive_file_id_temp);
    } catch (downloadError: any) {
      console.error("❌ Error al descargar el PDF temporal:", downloadError);
      return NextResponse.json({ error: 'No se pudo descargar el archivo original para firmar.' }, { status: 404 });
    }

    // 6. Pre-crear el archivo en la carpeta 'firmados' para obtener el File ID y la URL del QR
    let precreated: { fileId: string; url: string };
    try {
      precreated = await StorageService.precrear('firmados', `firmado-${doc.nombre_archivo}`);
    } catch (precreateError: any) {
      console.error("❌ Error al pre-crear el archivo en el almacenamiento:", precreateError);
      return NextResponse.json({ error: 'No se pudo preparar el archivo de salida.' }, { status: 500 });
    }

    // 7. Aplicar el proceso de firmado (Estampado Visual + PFX Opcional + QR)
    let signedPdfBuffer: Buffer;
    try {
      // Obtener dirección IP del firmante desde los headers de forma segura
      const ipHeader = request.headers.get('x-forwarded-for');
      const ip = ipHeader ? ipHeader.split(',')[0].trim() : 'IP no disponible';

      // Formatear la fecha de firma en horario de Colombia/Perú (GMT-5)
      const fechaFirma = new Date().toLocaleString('es-ES', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' (GMT-5)';

      const docAny = doc as any;

      signedPdfBuffer = await PDFSigner.firmarDocumento(pdfOriginalBuffer, signatureBuffer, {
        pageIndex: doc.pagina_num - 1,
        x: Number(doc.x_coord),
        y: Number(doc.y_coord),
        width: Number(doc.ancho),
        height: Number(doc.alto),
        nombreFirmante: firmante.full_name,
        fechaFirma: fechaFirma,
        ipFirmante: ip,
        documentoId: doc.id,
        // Opciones del código QR
        qrUrl: precreated.url,
        qrX: docAny.qr_x_coord !== null && docAny.qr_x_coord !== undefined ? Number(docAny.qr_x_coord) : undefined,
        qrY: docAny.qr_y_coord !== null && docAny.qr_y_coord !== undefined ? Number(docAny.qr_y_coord) : undefined,
        qrAncho: docAny.qr_ancho !== null && docAny.qr_ancho !== undefined ? Number(docAny.qr_ancho) : undefined,
        qrAlto: docAny.qr_alto !== null && docAny.qr_alto !== undefined ? Number(docAny.qr_alto) : undefined,
        qrPageIndex: docAny.qr_pagina_num !== null && docAny.qr_pagina_num !== undefined ? (Number(docAny.qr_pagina_num) - 1) : undefined,
      });
    } catch (signingError: any) {
      return NextResponse.json({ error: `Error durante el procesamiento del PDF: ${signingError.message}` }, { status: 500 });
    }

    // 8. Actualizar el contenido del archivo con el PDF firmado final en Drive/Local
    let storedSignedFile;
    try {
      storedSignedFile = await StorageService.update('firmados', precreated.fileId, `firmado-${doc.nombre_archivo}`, signedPdfBuffer);
    } catch (updateError: any) {
      console.error("❌ Error al guardar el PDF firmado final:", updateError);
      return NextResponse.json({ error: 'No se pudo guardar el documento firmado final en el almacenamiento.' }, { status: 500 });
    }

    // 9. Actualizar base de datos
    await updateDocumentoFirma(doc.id, {
      estado: 'APROBADO',
      gdrive_file_id_final: storedSignedFile.fileId,
    });

    // 9. Eliminar el archivo temporal de entrada
    try {
      await StorageService.delete('entrada', doc.gdrive_file_id_temp);
    } catch (deleteError) {
      console.warn("⚠️ No se pudo eliminar el archivo temporal de entrada en Drive/Local:", deleteError);
    }

    console.log(`✅ Documento "${doc.nombre_archivo}" firmado con éxito por ${firmante.full_name}`);
    return NextResponse.json({ success: true, message: 'Documento firmado con éxito' });
  } catch (error: any) {
    console.error("❌ Error en /api/firmas/procesar:", error);
    return NextResponse.json({ error: error.message || 'Error en el servidor al firmar' }, { status: 500 });
  }
}
