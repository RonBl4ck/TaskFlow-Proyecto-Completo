import { useState, useEffect, useRef } from 'react';
import { AuthSession, User, DocumentoFirma } from '@/lib/types';

interface FirmadorPageProps {
  session: AuthSession;
}

export default function FirmadorPage({ session }: FirmadorPageProps) {
  const [activeTab, setActiveTab] = useState<'solicitar' | 'bandeja' | 'historial'>('solicitar');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  // Si el usuario no tiene permisos de firma y no es administrador, no debería ver esta página.
  // Pero la doble validación en el Sidebar ya restringe el acceso.

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">✍️ Firmador de Documentos</h1>
          <p className="text-sm text-gray-500 mt-1">Envía y procesa solicitudes de firmas criptográficas de forma interactiva.</p>
        </div>
        
        {/* Tabs internas */}
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200/50 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('solicitar')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'solicitar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            📤 Solicitar Firma
          </button>
          <button
            onClick={() => setActiveTab('bandeja')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'bandeja' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            📥 Mi Bandeja
          </button>
          <button
            onClick={() => setActiveTab('historial')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'historial' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            📊 Historial
          </button>
        </div>
      </div>

      <div className="transition-all duration-300">
        {activeTab === 'solicitar' && <SolicitarFirmaView session={session} onComplete={() => setActiveTab('historial')} />}
        {activeTab === 'bandeja' && <BandejaView session={session} refreshKey={refreshKey} onActionComplete={refresh} />}
        {activeTab === 'historial' && <HistorialView session={session} refreshKey={refreshKey} />}
      </div>
    </div>
  );
}

// ==========================================
// 1. VISTA DE CREACIÓN / SOLICITUD DE FIRMA
// ==========================================
function SolicitarFirmaView({ session, onComplete }: { session: AuthSession; onComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [signers, setSigners] = useState<User[]>([]);
  const [selectedSignerId, setSelectedSignerId] = useState('');
  const [paginaNum, setPaginaNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 }); // Default to A4
  
  // Ancho y alto de la firma en puntos de PDF
  const [firmaAncho, setFirmaAncho] = useState(150);
  const [firmaAlto, setFirmaAlto] = useState(80);

  // Coordenadas relativas en porcentaje (0-100) sobre el lienzo simulador
  const [coordX, setCoordX] = useState(40);
  const [coordY, setCoordY] = useState(70);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);

  // Dimensiones porcentuales de la firma sobre la hoja simulada
  const widthPercent = (firmaAncho / pageSize.width) * 100;
  const heightPercent = (firmaAlto / pageSize.height) * 100;

  // Cargar pdfjs dinámicamente desde CDN cdnjs
  useEffect(() => {
    if ((window as any).pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setPdfjsLoaded(true);
    };
    document.body.appendChild(script);
  }, []);

  // Cargar el documento PDF mediante PDF.js cuando cambia el archivo
  useEffect(() => {
    if (!file || !pdfjsLoaded) return;

    const fileReader = new FileReader();
    fileReader.onload = async () => {
      try {
        const typedarray = new Uint8Array(fileReader.result as ArrayBuffer);
        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPaginaNum(1);
        setError('');
      } catch (err) {
        console.error("Error al procesar el PDF con PDF.js:", err);
        setError("Error al leer el archivo PDF. Asegúrate de que no esté corrupto o protegido con contraseña.");
      }
    };
    fileReader.readAsArrayBuffer(file);
  }, [file, pdfjsLoaded]);

  // Renderizar la página del PDF sobre el canvas
  useEffect(() => {
    if (!pdfDoc) return;

    let isCurrent = true;
    const renderPage = async () => {
      try {
        setRendering(true);
        const page = await pdfDoc.getPage(paginaNum);
        
        // Obtener tamaño real en puntos del PDF
        const viewportOrig = page.getViewport({ scale: 1.0 });
        if (isCurrent) {
          setPageSize({ width: viewportOrig.width, height: viewportOrig.height });
        }

        // Renderizar con escala mayor para buena nitidez
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasElementRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        if (isCurrent) {
          await page.render(renderContext).promise;
        }
      } catch (err) {
        console.error("Error renderizando página PDF:", err);
      } finally {
        if (isCurrent) {
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isCurrent = false;
    };
  }, [pdfDoc, paginaNum]);

  useEffect(() => {
    // Cargar los firmantes autorizados
    fetch('/api/firmas/signers')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSigners(data.signers || []);
          if (data.signers.length > 0) {
            setSelectedSignerId(data.signers[0].id);
          }
        }
      })
      .catch(err => console.error("Error al cargar firmantes", err));
  }, []);

  // Limpieza del URL de objeto al desmontar o cambiar archivo
  useEffect(() => {
    return () => {
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
      }
    };
  }, [pdfObjectUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError('');
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
      }
      setPdfObjectUrl(URL.createObjectURL(selected));
    } else {
      setError('Por favor, selecciona un archivo PDF válido.');
      setFile(null);
      setPdfDoc(null);
      setNumPages(1);
      setPageSize({ width: 595, height: 842 });
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
        setPdfObjectUrl(null);
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calcular porcentaje del clic relativo al contenedor simulador (0-100)
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    // Centrar el recuadro de firma basándose en su propio tamaño dinámico
    setCoordX(Math.max(0, Math.min(xPercent - (widthPercent / 2), 100 - widthPercent)));
    setCoordY(Math.max(0, Math.min(yPercent - (heightPercent / 2), 100 - heightPercent)));
  };

  // Estados y refs para arrastrar y cambiar tamaño de firma
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    initialCoordX: number;
    initialCoordY: number;
    initialWidth: number;
    initialHeight: number;
  }>({ pointerX: 0, pointerY: 0, initialCoordX: 0, initialCoordY: 0, initialWidth: 150, initialHeight: 80 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, action: 'drag' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    
    e.currentTarget.setPointerCapture(e.pointerId);

    if (action === 'drag') {
      setIsDragging(true);
      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        initialCoordX: coordX,
        initialCoordY: coordY,
        initialWidth: firmaAncho,
        initialHeight: firmaAlto,
      };
    } else if (action === 'resize') {
      setIsResizing(true);
      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        initialCoordX: coordX,
        initialCoordY: coordY,
        initialWidth: firmaAncho,
        initialHeight: firmaAlto,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (isDragging) {
      e.stopPropagation();
      const deltaX = e.clientX - dragStartRef.current.pointerX;
      const deltaY = e.clientY - dragStartRef.current.pointerY;

      const deltaXPercent = (deltaX / rect.width) * 100;
      const deltaYPercent = (deltaY / rect.height) * 100;

      let nextX = dragStartRef.current.initialCoordX + deltaXPercent;
      let nextY = dragStartRef.current.initialCoordY + deltaYPercent;

      nextX = Math.max(0, Math.min(nextX, 100 - widthPercent));
      nextY = Math.max(0, Math.min(nextY, 100 - heightPercent));

      setCoordX(nextX);
      setCoordY(nextY);
    } else if (isResizing) {
      e.stopPropagation();
      const deltaX = e.clientX - dragStartRef.current.pointerX;
      const deltaY = e.clientY - dragStartRef.current.pointerY;

      // Escala de píxeles en pantalla a puntos PDF
      const scaleX = pageSize.width / rect.width;
      const scaleY = pageSize.height / rect.height;

      const deltaWidthPoints = deltaX * scaleX;
      const deltaHeightPoints = deltaY * scaleY;

      let nextWidth = dragStartRef.current.initialWidth + deltaWidthPoints;
      let nextHeight = dragStartRef.current.initialHeight + deltaHeightPoints;

      nextWidth = Math.max(60, Math.min(nextWidth, 300));
      nextHeight = Math.max(30, Math.min(nextHeight, 180));

      setFirmaAncho(Math.round(nextWidth));
      setFirmaAlto(Math.round(nextHeight));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor, sube un archivo PDF.');
      return;
    }
    if (!selectedSignerId) {
      setError('Por favor, selecciona un firmante.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const pdfWidthPoints = pageSize.width;
      const pdfHeightPoints = pageSize.height;

      const xPoints = (coordX / 100) * pdfWidthPoints;
      const yWebPoints = (coordY / 100) * pdfHeightPoints;
      const yPoints = pdfHeightPoints - yWebPoints - firmaAlto;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('firmanteId', selectedSignerId);
      formData.append('x', xPoints.toFixed(2));
      formData.append('y', yPoints.toFixed(2));
      formData.append('ancho', firmaAncho.toString());
      formData.append('alto', firmaAlto.toString());
      formData.append('paginaNum', paginaNum.toString());

      const res = await fetch('/api/firmas/solicitar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        setError(data.error || 'Error al enviar la solicitud.');
      }
    } catch (err) {
      setError('Error de red al procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] bg-white p-6 rounded-2xl border border-gray-200">
      
      {/* Formulario Izquierdo */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-800">1. Configurar Documento</h2>
          <p className="text-xs text-gray-400 mt-0.5">Sube el archivo PDF y parametriza la firma.</p>
        </div>

        {error && <div className="p-3.5 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-100">{error}</div>}
        {success && <div className="p-3.5 bg-green-50 text-green-700 text-xs font-semibold rounded-xl border border-green-100">🎉 ¡Solicitud de firma enviada con éxito!</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Archivo PDF *</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-xl p-1"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-medium">Asignar Firmante *</label>
            <select
              value={selectedSignerId}
              onChange={e => setSelectedSignerId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 font-medium"
              required
            >
              {signers.length === 0 && <option value="">No hay firmantes disponibles</option>}
              {signers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-medium">Número de Página *</label>
              <input
                type="number"
                min={1}
                max={numPages}
                value={paginaNum}
                onChange={e => setPaginaNum(Math.max(1, Math.min(numPages, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 font-semibold"
                required
              />
            </div>
            
            <div className="flex flex-col justify-end">
              <span className="text-[10px] text-gray-400 font-medium pb-2">
                {numPages > 1 ? `* Documento con ${numPages} páginas.` : `* Selecciona la página del PDF en la que se estampará la firma.`}
              </span>
            </div>
          </div>

          {/* Ajuste de Tamaño de Firma */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/50 space-y-4">
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide">📐 Tamaño de la Firma</label>
            <div className="flex gap-2">
              {[
                { label: 'Chica', w: 100, h: 50 },
                { label: 'Normal', w: 150, h: 80 },
                { label: 'Grande', w: 200, h: 100 },
                { label: 'Extra', w: 250, h: 120 }
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setFirmaAncho(preset.w); setFirmaAlto(preset.h); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    firmaAncho === preset.w && firmaAlto === preset.h
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between text-xs text-gray-500 font-bold mb-1">
                  <span>Ancho: {firmaAncho} pt</span>
                  <span className="text-gray-400">({(firmaAncho * 0.35).toFixed(0)} mm)</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={300}
                  step={5}
                  value={firmaAncho}
                  onChange={e => setFirmaAncho(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              
              <div>
                <div className="flex justify-between text-xs text-gray-500 font-bold mb-1">
                  <span>Alto: {firmaAlto} pt</span>
                  <span className="text-gray-400">({(firmaAlto * 0.35).toFixed(0)} mm)</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={180}
                  step={5}
                  value={firmaAlto}
                  onChange={e => setFirmaAlto(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !file || success}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Procesando archivo...</span>
            </>
          ) : (
            <span>🚀 Enviar Solicitud de Firma</span>
          )}
        </button>
      </form>

      {/* Simulador Interactivo Derecho */}
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border border-gray-200/50 w-full">
        <div className="mb-4 text-center">
          <h2 className="text-sm font-bold text-gray-700">2. Ubicar Firma de Forma Visual</h2>
          <p className="text-xs text-gray-400 mt-1">
            {file 
              ? 'Mueve y redimensiona el recuadro azul o haz clic sobre el PDF real.' 
              : 'Haz clic en la hoja simulada para ubicar la firma.'}
          </p>
        </div>

        {/* Lienzo Simulador con Proporción Dinámica según el tamaño de la página PDF */}
        <div 
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }}
          className="relative w-full max-w-[280px] sm:max-w-[340px] bg-white border border-gray-300 rounded-xl shadow-md cursor-crosshair overflow-hidden select-none flex items-center justify-center"
        >
          {file ? (
            <>
              {/* Canvas para renderizado real del PDF */}
              <canvas 
                ref={canvasElementRef}
                className="absolute inset-0 w-full h-full object-contain z-0"
              />
              
              {/* Spinner mientras renderiza */}
              {rendering && (
                <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          ) : (
            // Vista simulada de texto por defecto (si no hay PDF seleccionado)
            <div className="absolute inset-0 flex flex-col justify-between p-4 z-0 bg-white">
              <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
              <div className="text-[9px] text-gray-300 font-semibold tracking-wider flex justify-between pointer-events-none">
                <span>TASKFLOW DOCUMENT</span>
                <span>PÁGINA {paginaNum}</span>
              </div>
              <div className="space-y-3 py-6 px-2 pointer-events-none">
                <div className="h-2 w-3/4 bg-gray-100 rounded" />
                <div className="h-2 w-full bg-gray-100 rounded" />
                <div className="h-2 w-5/6 bg-gray-100 rounded" />
                <div className="h-2 w-full bg-gray-100 rounded" />
                <div className="h-2 w-2/3 bg-gray-100 rounded" />
                <div className="h-2 w-full bg-gray-100 rounded" />
                <div className="h-2 w-3/4 bg-gray-100 rounded" />
              </div>
              <div className="h-1 bg-gray-200 rounded pointer-events-none" />
            </div>
          )}

          {/* Overlay transparente para capturar clics de forma segura por encima del PDF */}
          <div className="absolute inset-0 z-10 bg-transparent" />

          {/* Recuadro de firma flotante en la posición exacta */}
          <div 
            onPointerDown={(e) => handlePointerDown(e, 'drag')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ 
              left: `${coordX}%`, 
              top: `${coordY}%`,
              width: `${widthPercent}%`, 
              height: `${heightPercent}%` 
            }}
            className={`absolute bg-blue-500/20 border-2 border-blue-500 rounded-lg flex flex-col items-center justify-center p-1 z-20 cursor-move select-none shadow-lg group pointer-events-auto touch-none transition-all duration-75 ${
              isDragging ? 'border-dashed scale-102 bg-blue-500/35 ring-2 ring-blue-400/50' : 'animate-pulse'
            }`}
          >
            <span className="text-[8px] font-bold text-blue-700 leading-none drop-shadow-sm pointer-events-none">✍️ MOVER</span>
            <span className="text-[6px] text-blue-800 font-bold scale-75 mt-0.5 whitespace-nowrap drop-shadow-sm pointer-events-none">
              {firmaAncho}x{firmaAlto} pt
            </span>

            {/* Tirador de cambio de tamaño (Resize Handle) en la esquina inferior derecha */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'resize')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute bottom-0 right-0 w-4 h-4 bg-blue-600 hover:bg-blue-700 rounded-tl-md rounded-br-md border-t border-l border-blue-400 cursor-se-resize flex items-center justify-center z-30 pointer-events-auto shadow"
              title="Arrastra para redimensionar"
            >
              <svg className="w-2.5 h-2.5 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 19H5m14 0V5" />
              </svg>
            </div>
          </div>
        </div>
        
        {file && (
          <div className="mt-4 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200 text-xs font-bold shadow-sm">
            📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. BANDEJA DE ENTRADA (PENDIENTES POR FIRMAR)
// ==========================================
function BandejaView({ session, refreshKey, onActionComplete }: { session: AuthSession; refreshKey: number; onActionComplete: () => void }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [error, setError] = useState('');
  const selectedDocId = selectedDoc?.id;

  useEffect(() => {
    const loadDocuments = () => {
      setLoading(true);
      fetch('/api/firmas/listar?filter=firmante')
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            // Filtrar solo los pendientes de firma
            const pend = (data.documents || []).filter((d: any) => d.estado === 'PENDIENTE');
            setDocuments(pend);
            if (selectedDocId) {
              const fresh = pend.find((d: any) => d.id === selectedDocId);
              setSelectedDoc(fresh || null);
            }
          }
        })
        .catch(err => console.error("Error al cargar pendientes", err))
        .finally(() => setLoading(false));
    };

    loadDocuments();
  }, [refreshKey, selectedDocId]);

  const handleApprove = async () => {
    if (!selectedDoc) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/firmas/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDoc.id }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedDoc(null);
        onActionComplete();
      } else {
        setError(data.error || 'Ocurrió un error al firmar el documento.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !rejectionReason.trim()) return;
    
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/firmas/rechazar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDoc.id, motivo: rejectionReason }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRejectModal(false);
        setRejectionReason('');
        setSelectedDoc(null);
        onActionComplete();
      } else {
        setError(data.error || 'Ocurrió un error al rechazar el documento.');
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-gray-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-semibold">Cargando bandeja de firmas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      
      {/* Listado de Pendientes (Izquierda) */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">📥 Documentos por Firmar ({documents.length})</h2>
        {documents.length === 0 ? (
          <div className="py-12 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-4">
            <span className="text-3xl">☕</span>
            <h3 className="font-bold text-gray-700 mt-2">¡Todo al día!</h3>
            <p className="text-xs text-gray-400 mt-1">No tienes solicitudes de firmas pendientes en este momento.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                  selectedDoc?.id === doc.id
                    ? 'border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/5'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <span className="text-xl mt-0.5">📄</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-sm truncate">{doc.nombre_archivo}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Enviado por: {doc.emisor?.fullName || 'Sistema'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200 px-2 py-0.5 rounded-full uppercase">PENDIENTE</span>
                    <span className="text-[10px] text-gray-400 font-semibold">{new Date(doc.creado_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visor e Interacción de Firma (Derecha) */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200">
        {selectedDoc ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-gray-800 text-base">{selectedDoc.nombre_archivo}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Enviado por: <span className="font-semibold text-gray-600">{selectedDoc.emisor?.fullName}</span> | Pág: {selectedDoc.pagina_num}</p>
              </div>
              <button 
                onClick={() => setSelectedDoc(null)}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium"
              >
                Cerrar Visor ✕
              </button>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-100">{error}</div>}

            {/* Visualizador de PDF Embebido utilizando la API proxy ver */}
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 h-[380px] shadow-inner relative flex flex-col justify-between">
              <iframe
                src={`${selectedDoc.fileUrl}#toolbar=0`}
                className="w-full h-full object-cover"
                title="Visor PDF"
              />
              {/* Overlay informativo sobre la firma */}
              <div className="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg pointer-events-none animate-pulse uppercase tracking-wider">
                📍 Firma en Página {selectedDoc.pagina_num}
              </div>
            </div>

            {/* Controles de Acción */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="px-5 py-3 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors flex-1 cursor-pointer text-sm"
              >
                ✕ Rechazar Solicitud
              </button>
              
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/20 flex-1 flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Firmando documento...</span>
                  </>
                ) : (
                  <>
                    <span>✍️ Firmar con un Clic</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center text-gray-400 p-6">
            <span className="text-4xl">👁️</span>
            <h3 className="font-bold text-gray-700 mt-3">Visualización de Documentos</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">Selecciona un documento de la bandeja de entrada para revisarlo e interactuar.</p>
          </div>
        )}
      </div>

      {/* Modal de Motivo de Rechazo */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-base">Rechazar Solicitud de Firma</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 font-medium">Motivo del Rechazo *</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                  placeholder="Especifica el motivo por el cual no firmarás este documento..."
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Rechazando...' : 'Rechazar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. VISTA DE HISTORIAL DE FIRMAS (APROBADOS/RECHAZADOS)
// ==========================================
function HistorialView({ session, refreshKey }: { session: AuthSession; refreshKey: number }) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'emisor' | 'firmante'>('all');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/firmas/listar?filter=${filterType}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setDocuments(data.documents || []);
        }
      })
      .catch(err => console.error("Error al cargar historial", err))
      .finally(() => setLoading(false));
  }, [refreshKey, filterType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-gray-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-semibold">Cargando historial de documentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-5">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-lg font-bold text-gray-800">📊 Trazabilidad e Historial</h2>
        
        {/* Filtros rápidos */}
        <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'all' ? 'bg-white text-gray-800 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('emisor')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'emisor' ? 'bg-white text-gray-800 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Enviados
          </button>
          <button
            onClick={() => setFilterType('firmante')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filterType === 'firmante' ? 'bg-white text-gray-800 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Por Firmar
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="py-12 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center p-4">
          <span className="text-3xl">📭</span>
          <h3 className="font-bold text-gray-700 mt-2">Bandeja Vacía</h3>
          <p className="text-xs text-gray-400 mt-1">No se encontraron registros de documentos firmados o enviados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Documento</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Flujo de Firmas</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Descargas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      <div>
                        <p className="font-bold text-gray-800 max-w-[200px] truncate">{doc.nombre_archivo}</p>
                        <p className="text-[10px] text-gray-400">Pág: {doc.pagina_num} | Coords: ({Number(doc.x_coord).toFixed(0)}, {Number(doc.y_coord).toFixed(0)})</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-xs space-y-0.5">
                      <span className="text-gray-500">De: <span className="font-semibold text-gray-700">{doc.emisor?.fullName || 'Sistema'}</span></span>
                      <span className="text-gray-500">Para: <span className="font-semibold text-gray-700">{doc.firmante?.fullName}</span></span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {doc.estado === 'PENDIENTE' && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Pendiente
                      </span>
                    )}
                    {doc.estado === 'APROBADO' && (
                      <span className="text-[10px] bg-green-50 text-green-700 font-bold border border-green-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Firmado
                      </span>
                    )}
                    {doc.estado === 'RECHAZADO' && (
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[10px] bg-red-50 text-red-700 font-bold border border-red-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          Rechazado
                        </span>
                        {doc.motivo_rechazo && (
                          <span className="text-[10px] text-red-600 italic max-w-[180px] truncate" title={doc.motivo_rechazo}>
                            &quot;{doc.motivo_rechazo}&quot;
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-gray-500">
                    {new Date(doc.creado_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {doc.estado === 'APROBADO' && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition-colors border border-blue-200 shadow-sm cursor-pointer"
                      >
                        ⬇️ Descargar PDF
                      </a>
                    )}
                    {doc.estado === 'PENDIENTE' && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-xs rounded-lg transition-colors border border-gray-200 cursor-pointer"
                      >
                        👁️ Ver Original
                      </a>
                    )}
                    {doc.estado === 'RECHAZADO' && (
                      <span className="text-xs text-gray-400 italic">No disponible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
