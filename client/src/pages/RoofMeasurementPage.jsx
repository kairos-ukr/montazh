import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // Додані хуки для навігації
import { Upload, ZoomIn, ZoomOut, Trash2, X, Edit3, CloudUpload, Loader2, Maximize2 } from 'lucide-react';

// ВСТАВ СВІЙ URL ТУТ АБО БЕРИ З .ENV
const API_URL = 'https://quiet-water-a1ad.kairosost38500.workers.dev'; 

const RoofMeasurementPage = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Беремо ID з URL (наприклад /measurements/123)
  const objectNumber = id; // Використовуємо його як номер об'єкта

  // --- ВЕСЬ ТВІЙ СТАН (STATE) ЗАЛИШИВСЯ БЕЗ ЗМІН ---
  const [photos, setPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  
  const [measurements, setMeasurements] = useState({});
  const [currentPoints, setCurrentPoints] = useState([]);
  
  const [showDialog, setShowDialog] = useState(false);
  const [dialogData, setDialogData] = useState({ distance: '', unit: 'м' });

  const [isUploading, setIsUploading] = useState(false);
  
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentPhoto = photos[currentPhotoIndex];
  const currentMeasurements = measurements[currentPhoto?.id] || { lines: [] };

  // --- ЛОГІКА МАЛЮВАННЯ (1 в 1 як у тебе) ---
  const renderMeasurement = (ctx, line, scaleFactor) => {
    const { pointA, pointB, distance, unit } = line;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    const x1 = pointA.x * width;
    const y1 = pointA.y * height;
    const x2 = pointB.x * width;
    const y2 = pointB.y * height;

    const LINE_WIDTH = 4 * scaleFactor;
    const OUTLINE_WIDTH = 7 * scaleFactor;
    const DOT_RADIUS = 12 * scaleFactor;
    const FONT_SIZE = 36 * scaleFactor;
    const LABEL_PADDING_X = 16 * scaleFactor;
    const LABEL_PADDING_Y = 10 * scaleFactor;

    // Біла обводка
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Основна синя лінія
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Точки
    const drawDot = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS + (2 * scaleFactor), 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS * 0.6, 0, 2 * Math.PI);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
    };
    drawDot(x1, y1);
    drawDot(x2, y2);

    // Бейдж з текстом
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const text = `${distance} ${unit}`;

    ctx.font = `bold ${FONT_SIZE}px sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const boxWidth = textWidth + (LABEL_PADDING_X * 2);
    const boxHeight = FONT_SIZE + (LABEL_PADDING_Y * 2);
    
    const rectX = midX - boxWidth / 2;
    const rectY = midY - boxHeight / 2;
    const radius = 8 * scaleFactor;

    ctx.beginPath();
    ctx.moveTo(rectX + radius, rectY);
    ctx.lineTo(rectX + boxWidth - radius, rectY);
    ctx.quadraticCurveTo(rectX + boxWidth, rectY, rectX + boxWidth, rectY + radius);
    ctx.lineTo(rectX + boxWidth, rectY + boxHeight - radius);
    ctx.quadraticCurveTo(rectX + boxWidth, rectY + boxHeight, rectX + boxWidth - radius, rectY + boxHeight);
    ctx.lineTo(rectX + radius, rectY + boxHeight);
    ctx.quadraticCurveTo(rectX, rectY + boxHeight, rectX, rectY + boxHeight - radius);
    ctx.lineTo(rectX, rectY + radius);
    ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
    ctx.closePath();

    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3 * scaleFactor;
    ctx.strokeStyle = '#2563eb';
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.fillText(text, midX, midY + (scaleFactor * 2));
  };

  // --- ЕФЕКТИ (Прибрав лише блокування скролу body) ---
  useEffect(() => {
    // Малюємо канвас при зміні параметрів
    setTimeout(drawCanvas, 100);
  }, [currentPhoto, zoom, currentMeasurements, currentPoints, pan]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentPhotoIndex]);

  // --- ОБРОБНИКИ ПОДІЙ (1 в 1) ---
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((file, index) => ({
      id: Date.now() + index,
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));
    
    setPhotos([...photos, ...newPhotos]);
    if (photos.length === 0) {
      setCurrentPhotoIndex(0);
    }
  };

  const deletePhoto = () => {
    if (!currentPhoto || photos.length === 0) return;
    const newPhotos = photos.filter((_, index) => index !== currentPhotoIndex);
    const newMeasurements = { ...measurements };
    delete newMeasurements[currentPhoto.id];
    setPhotos(newPhotos);
    setMeasurements(newMeasurements);
    setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1));
  };

  const drawCanvas = () => {
    if (!canvasRef.current || !imageRef.current || !currentPhoto) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    if (!img.complete) return;
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxDimension = Math.max(canvas.width, canvas.height);
    const scaleFactor = maxDimension / 1500; 
    
    currentMeasurements.lines.forEach((line) => {
      renderMeasurement(ctx, line, scaleFactor);
    });
    
    if (currentPoints.length > 0) {
      const p1 = currentPoints[0];
      const x1 = p1.x * canvas.width;
      const y1 = p1.y * canvas.height;
      const DOT_RADIUS = 12 * scaleFactor;

      ctx.beginPath();
      ctx.arc(x1, y1, DOT_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = '#2563eb';
      ctx.fill();
      ctx.lineWidth = 3 * scaleFactor;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      if (currentPoints.length > 1) {
        const p2 = currentPoints[1];
        const x2 = p2.x * canvas.width;
        const y2 = p2.y * canvas.height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 4 * scaleFactor;
        ctx.setLineDash([15 * scaleFactor, 10 * scaleFactor]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(x2, y2, DOT_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.stroke();
      }
    }
  };

  const handleCanvasClick = (e) => {
    if (!currentPhoto || hasMoved) {
      setHasMoved(false);
      return;
    }
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = ((e.clientX - rect.left) * scaleX) / canvas.width;
    const y = ((e.clientY - rect.top) * scaleY) / canvas.height;
    
    if (currentPoints.length === 0) {
      setCurrentPoints([{ x, y }]);
    } else if (currentPoints.length === 1) {
      setCurrentPoints([...currentPoints, { x, y }]);
      setShowDialog(true);
      setDialogData({ distance: '', unit: 'м' });
    }
  };

  const handleMouseDown = (e) => {
    if (zoom > 1 && e.button === 0) {
      setIsPanning(true);
      setHasMoved(false);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setHasMoved(true);
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1 && zoom > 1) {
      setIsPanning(true);
      setHasMoved(false);
      setPanStart({ 
        x: e.touches[0].clientX - pan.x, 
        y: e.touches[0].clientY - pan.y 
      });
    }
  };

  const handleTouchMove = (e) => {
    if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      setHasMoved(true);
      setPan({
        x: e.touches[0].clientX - panStart.x,
        y: e.touches[0].clientY - panStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const saveMeasurement = () => {
    if (!dialogData.distance) {
      alert('Будь ласка, введіть відстань');
      return;
    }
    const newLine = {
      pointA: currentPoints[0],
      pointB: currentPoints[1],
      distance: dialogData.distance.replace(',', '.'),
      unit: dialogData.unit
    };
    setMeasurements({
      ...measurements,
      [currentPhoto.id]: {
        lines: [...currentMeasurements.lines, newLine]
      }
    });
    setCurrentPoints([]);
    setShowDialog(false);
    setDialogData({ distance: '', unit: 'м' });
  };

  const deleteLastMeasurement = () => {
    if (currentMeasurements.lines.length === 0) return;
    const newLines = currentMeasurements.lines.slice(0, -1);
    setMeasurements({
      ...measurements,
      [currentPhoto.id]: { lines: newLines }
    });
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // --- ЛОГІКА ЗАВАНТАЖЕННЯ (Твоя, тільки перевірка ID додана) ---
  const handleUpload = async () => {
    if (!currentPhoto) return;
    if (!objectNumber) {
        alert("Помилка: Не вказано ID об'єкта!");
        return;
    }

    setIsUploading(true);

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = imageRef.current;
        
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        ctx.drawImage(img, 0, 0);
        
        const maxDimension = Math.max(canvas.width, canvas.height);
        const scaleFactor = maxDimension / 1500;
        
        currentMeasurements.lines.forEach((line) => {
            renderMeasurement(ctx, line, scaleFactor);
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                alert("Помилка генерації зображення");
                setIsUploading(false);
                return;
            }

            const formData = new FormData();
            formData.append('files', blob, `measurement.jpg`); 
            formData.append('object_number', objectNumber);
            formData.append('doc_type', 'Заміри');

            const response = await fetch(`${API_URL}/upload/`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Помилка завантаження");
            }

            const result = await response.json();
            alert(`Успішно збережено в папку: ${result.folder}`);
            
            setIsUploading(false);

        }, 'image/jpeg', 0.95);

    } catch (error) {
        console.error("Upload error:", error);
        alert(`Помилка: ${error.message}`);
        setIsUploading(false);
    }
  };

  // --- ВЕРСТКА СТОРІНКИ (Твій дизайн, розтягнутий на екран) ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* 1. Header Navigation - Як у твоїй модалці, тільки на всю ширину */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
           <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2 truncate">
              <Edit3 className="text-blue-600 flex-shrink-0"/> 
              <span className="truncate">RoofMaster - Заміри дахів</span>
           </h1>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
           <button 
              onClick={() => navigate(-1)} // Повертаємось назад
              className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-full shadow-lg transition"
            >
              <X size={20} />
            </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col p-2 sm:p-4 overflow-hidden h-[calc(100vh-64px)]">
        
        <div className="flex justify-between items-center mb-4 px-2">
            <div className="text-sm text-slate-500 font-bold">
                Об'єкт #{objectNumber}
            </div>
            <div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                <button 
                onClick={() => fileInputRef.current.click()} 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg shadow-md transition text-sm font-medium"
                >
                <Upload size={18} className="flex-shrink-0" /> 
                <span className="hidden sm:inline whitespace-nowrap">Додати фото</span>
                </button>
            </div>
        </div>

        {photos.length > 0 ? (
           <div className="flex flex-col lg:flex-row h-full gap-4 overflow-y-auto">
              
              {/* Image Editor Container (Твій) */}
              <div className="flex-1 flex flex-col min-h-[500px]">
                 <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                      {photos.map((p, idx) => (
                        <div 
                          key={p.id} 
                          onClick={() => setCurrentPhotoIndex(idx)} 
                          className={`relative min-w-[60px] h-[60px] rounded-lg border-2 cursor-pointer overflow-hidden transition-all flex-shrink-0 ${
                            currentPhotoIndex === idx ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200 opacity-60'
                          }`}
                        >
                          <img src={p.url} className="w-full h-full object-cover" alt="" />
                        </div>
                      ))}
                 </div>

                 <div className="flex-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative">
                    <div 
                        ref={containerRef} 
                        className="relative overflow-hidden bg-slate-100 flex items-center justify-center select-none w-full h-full min-h-[400px]"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      >
                        <div 
                          className="relative inline-block transition-transform duration-100 ease-out"
                          style={{ 
                            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                            transformOrigin: 'center',
                            cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'crosshair'
                          }}
                        >
                          <img 
                            ref={imageRef} 
                            src={currentPhoto.url} 
                            alt={currentPhoto.name} 
                            className="max-w-none max-h-none block select-none pointer-events-none" 
                            style={{ maxHeight: '70vh', maxWidth: '100%' }}
                            onLoad={drawCanvas}
                            draggable={false}
                          />
                          <canvas 
                            ref={canvasRef} 
                            onClick={handleCanvasClick} 
                            className="absolute top-0 left-0 w-full h-full"
                            style={{ 
                              cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'crosshair'
                            }}
                          />
                        </div>
                     </div>

                     {/* Zoom Controls Overlay (Твій) */}
                     <div className="absolute bottom-4 right-4 flex gap-2">
                        <div className="bg-white/95 backdrop-blur-sm p-1 rounded-lg shadow-lg border border-slate-200 flex gap-1">
                          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-2 hover:bg-slate-100 rounded text-slate-700 transition"><ZoomOut size={20}/></button>
                          <span className="flex items-center px-2 text-xs font-bold text-slate-500 w-[50px] justify-center">{Math.round(zoom*100)}%</span>
                          <button onClick={() => setZoom(Math.min(4, zoom + 0.25))} className="p-2 hover:bg-slate-100 rounded text-slate-700 transition"><ZoomIn size={20}/></button>
                          <div className="w-px bg-slate-200 mx-1"></div>
                          <button onClick={resetZoom} className="p-2 hover:bg-slate-100 rounded text-slate-700 transition" title="Скинути"><Maximize2 size={20}/></button>
                        </div>
                      </div>
                 </div>
              </div>

              {/* Sidebar Controls (Твій, адаптований під сторінку) */}
              <div className="w-full lg:w-[320px] flex flex-col gap-4 shrink-0 pb-10">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3">
                      <button 
                        onClick={deleteLastMeasurement} 
                        disabled={currentMeasurements.lines.length === 0} 
                        className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-3 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={18} /> Видалити останній
                      </button>
                      
                      <button 
                        onClick={handleUpload} 
                        disabled={isUploading}
                        className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg transition transform active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                      >
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <CloudUpload size={18} />}
                        <span>{isUploading ? "Збереження..." : "Відправити замір"}</span>
                      </button>

                      <button onClick={deletePhoto} className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-sm mt-2 transition">
                        <X size={16} /> Видалити фото з проєкту
                      </button>
                  </div>

                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 overflow-y-auto min-h-[200px]">
                      <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-3">
                        Заміри ({currentMeasurements.lines.length})
                      </h3>
                      <div className="space-y-2">
                        {currentMeasurements.lines.length === 0 && (
                          <p className="text-sm text-slate-400 italic">На фото поки немає розмірів.</p>
                        )}
                        {currentMeasurements.lines.map((line, index) => (
                          <div key={index} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">
                              #{index + 1}
                            </span>
                            <span className="font-bold text-slate-800">
                              {line.distance} <span className="text-sm font-normal text-slate-500">{line.unit}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                  </div>
              </div>

           </div>
        ) : (
          /* Empty State (Твій) */
          <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-slate-400 m-4 bg-white rounded-2xl border border-dashed border-slate-300">
             <div onClick={() => fileInputRef.current.click()} className="flex flex-col items-center gap-4 cursor-pointer p-10 hover:opacity-70 transition">
                <Upload size={64} className="opacity-30" />
                <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-700">Немає фото</h3>
                    <p className="text-sm mt-1">Натисніть, щоб додати перше фото</p>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Measurement Dialog (Native Style - Твій) */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[330]">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Введіть відстань</h2>
            <input 
              type="number" 
              inputMode="decimal" 
              value={dialogData.distance} 
              onChange={(e) => setDialogData({ ...dialogData, distance: e.target.value })}
              placeholder="0.00" 
              className="w-full text-center text-4xl font-bold text-slate-800 border-b-2 border-blue-500 focus:outline-none bg-transparent py-4 mb-6" 
              autoFocus 
            />
            
            <div className="flex justify-center gap-2 mb-6">
              {['м', 'см', 'мм'].map((u) => (
                <button 
                  key={u} 
                  onClick={() => setDialogData({...dialogData, unit: u})}
                  className={`px-4 py-2 rounded-lg font-bold transition ${
                    dialogData.unit === u 
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' 
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={saveMeasurement} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg transition active:scale-95">Зберегти</button>
              <button onClick={() => { setShowDialog(false); setCurrentPoints([]); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold transition">Скасувати</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RoofMeasurementPage;