# Sistema de Firma de Documentos PDF en TaskFlow

## Resultado Final y Criterios de Éxito
- **Resultado final:** Un flujo completo de solicitud y aprobación de firmas dentro de TaskFlow, donde el Emisor (Perfil A) posiciona la firma en un PDF, y el Firmante (Perfil B) revisa y firma con un solo clic. El documento final se sella criptográficamente (con un archivo PFX), se le añade la imagen visual de la firma sin fondo y se guarda permanentemente en Google Drive.
- **Criterios de éxito:**
  1. El Emisor puede cargar un PDF y previsualizar dónde se insertará la firma usando un recuadro.
  2. El sistema ahorra recursos procesando el PDF final **sólo** cuando el Firmante (Perfil B) aprueba la solicitud. El documento original se mantiene en un almacenamiento temporal.
  3. Se genera un registro/historial de los documentos en base de datos (estados: PENDIENTE, APROBADO, RECHAZADO).
  4. Los archivos finales se almacenan en Google Drive (cuenta de 2TB) mediante API en lugar de consumir almacenamiento de Vercel/Supabase.
  5. El PDF final contiene tanto la imagen visual de la firma como un sello criptográfico PFX para bloquear la edición del documento.

## Riesgos y Mitigación (User Review Required)
> [!WARNING]
> **Integración con Google Drive:** Para que la app suba los archivos automáticamente a tu Drive sin que el usuario inicie sesión en Google, necesitaremos usar una **Cuenta de Servicio (Service Account)** de Google Cloud.
> *Mitigación:* Yo te guiaré paso a paso para crear el archivo de credenciales `.json` y compartir tu carpeta de Drive con el correo de esa cuenta de servicio.

> [!IMPORTANT]
> **Firma Digital (PFX):** Firmar digitalmente con un PFX en Node.js es posible (usaremos las librerías `pdf-lib` para la imagen y `node-signpdf` para el certificado). Sin embargo, un certificado `.pfx` autogenerado mostrará un aviso de "Certificado Desconocido o No Confiable" en Adobe Reader, a menos que compres uno en una Entidad Certificadora. 
> *Mitigación:* Generaremos un `.pfx` gratuito local. Cumplirá perfectamente el objetivo técnico: bloqueará el archivo contra modificaciones (se invalida si alguien edita el PDF), que es lo que brinda la seguridad.

## Open Questions
> [!NOTE]
> 1. ¿Deseas que cada Firmante tenga su propia imagen de firma (que deba subir previamente en su configuración de perfil), o usamos una imagen de firma estándar/única para todo el sistema?
> 2. ¿La carpeta en Google Drive estará organizada en subcarpetas dinámicas (por ejemplo, por año/mes o por usuario Emisor) o simplemente todos los documentos irán a una sola carpeta general?

## Plan por Fases (Proposed Changes)

### Fase 1: Preparación e Infraestructura
**Tareas:**
- Configurar proyecto en Google Cloud Console, habilitar la Google Drive API y crear las credenciales de la Cuenta de Servicio.
- Generar el certificado `.pfx` localmente (te daré el comando para que lo generemos).
- Añadir las nuevas librerías necesarias: `npm install pdf-lib node-signpdf react-pdf googleapis`.
- Crear el script SQL para la nueva tabla en Supabase: `documentos_firmas` (id, status, file_name, gdrive_file_id, gdrive_temp_id, x_coord, y_coord, page_num, emisor_id, firmante_id, motivo_rechazo).
**Entregable:** Infraestructura de almacenamiento y base de datos lista. Configuración del proyecto lista.
**Tiempo estimado:** 1 hora.

---

### Fase 2: Backend (Google Drive + Procesamiento PDF)
**Tareas:**
- Crear servicio `src/lib/gdrive.ts` para manejar subida (temporal y permanente) y descarga desde Google Drive.
- Crear servicio `src/lib/pdfSigner.ts` para abrir el PDF temporal, dibujar la firma .png en `(x,y)` y aplicar el sello digital `.pfx`.
- Crear las API Routes: `/api/firmas/upload` (sube temp), `/api/firmas/approve` (genera PDF final y sube a Drive), `/api/firmas/reject`.
**Entregable:** Backend funcional capaz de recibir flujos, firmar PDFs y guardarlos en Drive.
**Tiempo estimado:** 2 horas.

---

### Fase 3: Frontend (Visualizador y Perfil Emisor)
**Tareas:**
- Crear la pestaña `✍️ Firmador` en la barra lateral.
- Crear el componente `PdfSignerViewer.tsx` usando `react-pdf` para renderizar el documento página por página y capturar las coordenadas del clic.
- Vista para el Emisor: Botón de "Subir PDF", selector visual de la firma, selector de a quién asignar el documento (Firmante) y botón de enviar.
**Entregable:** Interfaz del Emisor terminada, donde hace clic para definir coordenadas.
**Tiempo estimado:** 2-3 horas.

---

### Fase 4: Frontend (Perfil Firmante e Historial)
**Tareas:**
- Crear vista de "Bandeja de Entrada" para que el Firmante vea documentos `PENDIENTES`.
- Vista de revisión: muestra el PDF con un recuadro indicando dónde irá la firma, con botones "Firmar" y "Rechazar" (incluyendo un modal para el motivo de rechazo).
- Vista de historial o "Dashboard de Firmas" para ver el estado de todos los documentos y enlaces directos al PDF en Google Drive.
**Entregable:** Flujo visual completo integrado.
**Tiempo estimado:** 2 horas.

## Checklist Final (Verification Plan)
### Verificación Automática (Backend)
- [ ] Las credenciales de Google Drive conectan y suben archivos de prueba correctamente.
- [ ] El motor de firma une correctamente el PDF + PNG + PFX sin romper el documento.

### Verificación Manual (Flujo)
- [ ] **Flujo Emisor:** Subir un PDF, seleccionar un área para la firma y enviarlo. Confirmar que se guarda en DB en estado `PENDIENTE` sin procesar un PDF nuevo.
- [ ] **Flujo Rechazo:** Iniciar sesión como Firmante, rechazar el documento. Confirmar que el Emisor ve el estado actualizado a `RECHAZADO` con el motivo especificado.
- [ ] **Flujo Aprobación:** Volver a enviar un documento. El Firmante lo aprueba. 
- [ ] **Validación Final:** Verificar que el sistema genera el archivo final con éxito, lo sube a Google Drive (dejando la URL en la BD), y al abrir el PDF se visualice la firma transparente en la posición correcta y con el panel de Firmas habilitado.
