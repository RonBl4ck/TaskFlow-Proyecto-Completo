export interface PDFSignerOptions {
  pageIndex: number; // 0-indexed
  x: number;         // Coordenada horizontal (sistema PDF: origen abajo-izquierda)
  y: number;         // Coordenada vertical (sistema PDF: origen abajo-izquierda)
  width: number;
  height: number;
  pfxCertBase64?: string;
  pfxPassword?: string;
}

export class PDFSigner {
  /**
   * Estampa la firma visualmente como imagen y aplica opcionalmente el sello criptográfico PFX.
   */
  static async firmarDocumento(
    pdfBuffer: Buffer,
    firmaImgBuffer: Buffer,
    options: PDFSignerOptions
  ): Promise<Buffer> {
    try {
      // Carga dinámica para evitar ralentizar arranques en frío (cold starts) de otras APIs
      const { PDFDocument } = await import('pdf-lib');
      const signpdfModule = await import('node-signpdf');
      const signpdf = signpdfModule.default || signpdfModule;

      console.log(`✏️ Iniciando estampado de firma visual en página ${options.pageIndex + 1}...`);
      
      // 1. Cargar el PDF original
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      
      // Validar índice de página
      const targetPageIndex = Math.max(0, Math.min(options.pageIndex, pages.length - 1));
      const page = pages[targetPageIndex];
      const { width: pageRealWidth, height: pageRealHeight } = page.getSize();
      
      // 2. Incrustar la imagen PNG de la firma
      const signatureImage = await pdfDoc.embedPng(firmaImgBuffer);
      
      // Validar dimensiones y ajustar coordenadas
      const sigWidth = options.width || 150;
      const sigHeight = options.height || 80;
      
      // Asegurar que la firma quepa en la página
      const safeX = Math.max(0, Math.min(options.x, pageRealWidth - sigWidth));
      const safeY = Math.max(0, Math.min(options.y, pageRealHeight - sigHeight));

      console.log(`📌 Posicionando firma visual en X:${safeX.toFixed(2)}, Y:${safeY.toFixed(2)} (Tamaño: ${sigWidth}x${sigHeight}) en un PDF de ${pageRealWidth}x${pageRealHeight}`);

      // 3. Dibujar la firma visual sobre la página elegida
      page.drawImage(signatureImage, {
        x: safeX,
        y: safeY,
        width: sigWidth,
        height: sigHeight,
      });

      // 4. Guardar los cambios del PDF visualmente firmado
      const visualPdfBytes = await pdfDoc.save();
      let pdfFinalBuffer = Buffer.from(visualPdfBytes);

      // 5. Firma digital criptográfica (PFX) opcional
      const pfxBase64 = options.pfxCertBase64 || process.env.PFX_CERT_BASE64;
      const pfxPassword = options.pfxPassword || process.env.PFX_PASSWORD;

      if (pfxBase64 && pfxPassword) {
        console.log("🔒 PFX detectado en la configuración. Iniciando sellado criptográfico...");
        try {
          const pfxBuffer = Buffer.from(pfxBase64, 'base64');
          
          // NOTA: node-signpdf requiere que el documento PDF tenga un placeholder de firma digital previamente agregado.
          // Para inyectar la firma digital con node-signpdf de forma sencilla:
          // Primero agregamos un campo de firma al PDF usando pdf-lib.
          const finalPdfDoc = await PDFDocument.load(pdfFinalBuffer);
          const formAny = finalPdfDoc.getForm() as any;
          
          // Crear un campo de firma digital de forma segura
          if (typeof formAny.createSignature === 'function') {
            const signatureField = formAny.createSignature('FirmaDigital');
            
            // Posicionar el widget en la página para asociar la firma digital PKI al documento
            signatureField.addToPage(finalPdfDoc.getPages()[targetPageIndex], {
              x: safeX,
              y: safeY,
              width: sigWidth,
              height: sigHeight,
            });
          } else {
            console.warn("⚠️ pdf-lib no soporta 'createSignature' de forma nativa en este entorno. Se omite el sello criptográfico para evitar daños en el archivo.");
          }
          
          const pdfWithPlaceholderBytes = await finalPdfDoc.save();
          const pdfWithPlaceholderBuffer = Buffer.from(pdfWithPlaceholderBytes);
          
          // Aplicar la firma criptográfica usando node-signpdf
          pdfFinalBuffer = signpdf.sign(pdfWithPlaceholderBuffer, pfxBuffer, {
            passphrase: pfxPassword,
          }) as any;
          
          console.log("✅ Sellado criptográfico PFX completado exitosamente.");
        } catch (signError: any) {
          console.error("⚠️ Ocurrió un error al aplicar el sello digital criptográfico PFX. Fallback a sólo firma visual de imagen activa.", signError);
          // Retornamos el buffer visual firmado en lugar de tumbar la operación
        }
      } else {
        console.log("ℹ️ No se ha configurado certificado PFX (o está vacío). El documento se procesa únicamente con la Firma Visual en Imagen.");
      }

      return pdfFinalBuffer;
    } catch (error: any) {
      console.error("❌ Error grave en el proceso de firmado de PDF:", error);
      throw error;
    }
  }

  /**
   * Helper para convertir coordenadas web (origen arriba-izquierda) a coordenadas PDF (origen abajo-izquierda).
   * @param clickY Coordenada Y en píxeles web o porcentaje
   * @param pageHeight Alto total de la página PDF
   * @param sigHeight Alto de la firma a estampar
   */
  static convertirCoordenadasWebAPdf(clickY: number, pageHeight: number, sigHeight: number): number {
    return pageHeight - clickY - sigHeight;
  }
}
