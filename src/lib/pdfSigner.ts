export interface PDFSignerOptions {
  pageIndex: number; // 0-indexed
  x: number;         // Coordenada horizontal (sistema PDF: origen abajo-izquierda)
  y: number;         // Coordenada vertical (sistema PDF: origen abajo-izquierda)
  width: number;
  height: number;
  pfxCertBase64?: string;
  pfxPassword?: string;
  nombreFirmante?: string;
  fechaFirma?: string;
  ipFirmante?: string;
  documentoId?: string;
  // Opciones para el código QR
  qrUrl?: string;
  qrX?: number;
  qrY?: number;
  qrAncho?: number;
  qrAlto?: number;
  qrPageIndex?: number;
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
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
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

      // 3. Dibujar Sello de Validación de fondo tenue
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const centerX = safeX + sigWidth / 2;
      const centerY = safeY + sigHeight / 2;
      const radius = Math.min(sigWidth, sigHeight) * 0.45;

      console.log(`🛡️ Estampando Sello de Validación de fondo en X:${centerX.toFixed(2)}, Y:${centerY.toFixed(2)} con radio ${radius.toFixed(2)}`);

      // Círculo exterior del sello
      page.drawCircle({
        x: centerX,
        y: centerY,
        size: radius,
        borderColor: rgb(0.05, 0.2, 0.5), // Azul tinta
        borderWidth: 1.5,
        opacity: 0.18, // Muy sutil
      });

      // Círculo interior del sello
      page.drawCircle({
        x: centerX,
        y: centerY,
        size: radius - 4,
        borderColor: rgb(0.05, 0.2, 0.5),
        borderWidth: 0.75,
        opacity: 0.12,
      });

      // Textos del sello (TASKFLOW VERIFICADO)
      const sealText1 = "TASKFLOW";
      const sealText2 = "VERIFICADO";
      
      const t1Size = Math.max(5, Math.min(8, radius * 0.25));
      const t2Size = Math.max(4, Math.min(7, radius * 0.2));
      
      const text1Width = helveticaBold.widthOfTextAtSize(sealText1, t1Size);
      const text2Width = helveticaBold.widthOfTextAtSize(sealText2, t2Size);

      page.drawText(sealText1, {
        x: centerX - text1Width / 2,
        y: centerY + (radius * 0.1),
        size: t1Size,
        font: helveticaBold,
        color: rgb(0.05, 0.2, 0.5),
        opacity: 0.25,
      });

      page.drawText(sealText2, {
        x: centerX - text2Width / 2,
        y: centerY - (radius * 0.2),
        size: t2Size,
        font: helveticaBold,
        color: rgb(0.05, 0.2, 0.5),
        opacity: 0.25,
      });

      // 4. Dibujar la firma visual encima del sello
      page.drawImage(signatureImage, {
        x: safeX,
        y: safeY,
        width: sigWidth,
        height: sigHeight,
      });

      // 5. Dibujar los metadatos de firma (Pie de firma)
      if (options.nombreFirmante) {
        console.log(`✍️ Estampando metadatos del firmante: ${options.nombreFirmante}`);
        const metaSize = 5.5;
        const lineSpacing = 7;
        
        const lineas: string[] = [
          `Firmado digitalmente por: ${options.nombreFirmante}`,
          `Fecha: ${options.fechaFirma || new Date().toLocaleString('es-ES')}`,
        ];
        
        if (options.ipFirmante) {
          lineas.push(`IP: ${options.ipFirmante}`);
        }
        
        if (options.documentoId) {
          const shortId = options.documentoId.substring(0, 8).toUpperCase();
          lineas.push(`Ref Transaccion: TF-${shortId}`);
        }

        // Determinar si dibujamos abajo o arriba de la firma para evitar salir de la página
        const totalHeightNeeded = lineas.length * lineSpacing;
        const dibujarAbajo = safeY >= (totalHeightNeeded + 5);
        
        let currentY = dibujarAbajo 
          ? safeY - 8 
          : safeY + sigHeight + totalHeightNeeded - 2;

        for (const linea of lineas) {
          page.drawText(linea, {
            x: safeX,
            y: currentY,
            size: metaSize,
            font: helveticaFont,
            color: rgb(0.15, 0.15, 0.15), // Gris oscuro muy formal
            opacity: 0.9,
          });
          currentY -= lineSpacing;
        }
      }
      // 5.1 Generar e incrustar el código QR si se especifica en las opciones
      if (options.qrUrl && options.qrX !== undefined && options.qrY !== undefined) {
        try {
          console.log(`📷 Generando código QR para URL: ${options.qrUrl}...`);
          const QRCode = await import('qrcode');
          
          const qrWidth = options.qrAncho || 70;
          const qrHeight = options.qrAlto || 70;
          
          // Generar el código QR en Base64
          const qrDataUrl = await QRCode.toDataURL(options.qrUrl, { margin: 1, width: qrWidth * 2 });
          const qrPngBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
          
          // Incrustar imagen del QR en el PDF
          const qrImage = await pdfDoc.embedPng(qrPngBuffer);
          
          const qrTargetPageIndex = options.qrPageIndex !== undefined ? options.qrPageIndex : targetPageIndex;
          const qrPage = pages[Math.max(0, Math.min(qrTargetPageIndex, pages.length - 1))];
          const { width: qrPageRealWidth, height: qrPageRealHeight } = qrPage.getSize();
          
          // Ajustar coordenadas seguras
          const safeQrX = Math.max(0, Math.min(options.qrX, qrPageRealWidth - qrWidth));
          const safeQrY = Math.max(0, Math.min(options.qrY, qrPageRealHeight - qrHeight));
          
          console.log(`📌 Posicionando código QR en X:${safeQrX.toFixed(2)}, Y:${safeQrY.toFixed(2)} en la página ${qrTargetPageIndex + 1}`);
          
          qrPage.drawImage(qrImage, {
            x: safeQrX,
            y: safeQrY,
            width: qrWidth,
            height: qrHeight,
          });

          // Dibujar leyenda debajo del QR
          const qrFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const captionText = "Verificar documento";
          const captionSize = 5;
          const captionWidth = qrFont.widthOfTextAtSize(captionText, captionSize);
          
          if (safeQrY >= 7) {
            qrPage.drawText(captionText, {
              x: safeQrX + (qrWidth / 2) - (captionWidth / 2),
              y: safeQrY - 6,
              size: captionSize,
              font: qrFont,
              color: rgb(0.3, 0.3, 0.3),
            });
          }
        } catch (qrError) {
          console.error("⚠️ Error al estampar el código QR en el PDF:", qrError);
        }
      }

      // 6. Guardar los cambios del PDF visualmente firmado
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
