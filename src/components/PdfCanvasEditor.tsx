import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { renderPdfPage } from '../utils/pdfEngine';
import { PageAnnotation, AnnotationType } from '../types/pdf';
import { usePinchZoom } from '../utils/usePinchZoom';
import { Trash2, Move, Edit3, Image as ImageIcon, Sparkles, X, Check } from 'lucide-react';
import { generateWolfCrestPng } from '../utils/samplePdfGenerator';

interface PdfCanvasEditorProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  scale: number;
  rotation: number;
  activeTool: AnnotationType | 'select' | 'pan';
  annotations: PageAnnotation[];
  onAddAnnotation: (ann: Omit<PageAnnotation, 'id' | 'createdAt'>) => void;
  onUpdateAnnotation: (id: string, updates: Partial<PageAnnotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onZoomChange: (newZoom: number) => void;
  onNavigateToPage: (page: number) => void;
  readingTheme: 'light' | 'dark' | 'sepia';
}

export const PdfCanvasEditor: React.FC<PdfCanvasEditorProps> = ({
  pdfDoc,
  currentPage,
  scale,
  rotation,
  activeTool,
  annotations,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onZoomChange,
  onNavigateToPage,
  readingTheme,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dragging state for creating new annotations
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Selected annotation for editing/moving
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraggingSelected, setIsDraggingSelected] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Inline text editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextVal, setEditingTextVal] = useState<string>('');

  // Image replacement picker modal
  const [showImagePicker, setShowImagePicker] = useState<boolean>(false);
  const [pendingImageCoords, setPendingImageCoords] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Pinch-to-zoom hook
  usePinchZoom(containerRef, {
    currentZoom: scale,
    onZoomChange,
    enabled: activeTool === 'select' || activeTool === 'pan',
  });

  // Render PDF page to canvas when page, scale, or rotation changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let isCancelled = false;

    renderPdfPage(pdfDoc, currentPage, canvasRef.current, scale, rotation).catch((err) => {
      if (!isCancelled) console.error('Error rendering page:', err);
    });

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage, scale, rotation]);

  // Convert client pointer event (mouse or touch) to percentage inside the canvas container
  const getPointerCanvasPercent = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const xPx = clientX - rect.left;
    const yPx = clientY - rect.top;

    const xPercent = (xPx / rect.width) * 100;
    const yPercent = (yPx / rect.height) * 100;

    return {
      x: Math.min(Math.max(xPercent, 0), 100),
      y: Math.min(Math.max(yPercent, 0), 100),
    };
  };

  const handlePointerDown = (e: React.MouseEvent) => {
    if (activeTool === 'pan') return;

    if (activeTool === 'select') {
      // Deselect if clicked on background
      if (e.target === canvasRef.current || (e.target as HTMLElement).id === 'annotation-overlay') {
        setSelectedId(null);
        setEditingTextId(null);
      }
      return;
    }

    const { x, y } = getPointerCanvasPercent(e);
    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentBox({ x, y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const { x, y } = getPointerCanvasPercent(e);

    const xMin = Math.min(startPos.x, x);
    const yMin = Math.min(startPos.y, y);
    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);

    setCurrentBox({ x: xMin, y: yMin, w: width, h: height });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentBox) {
      setIsDrawing(false);
      setStartPos(null);
      setCurrentBox(null);
      return;
    }

    const minSize = 2; // at least 2% in width/height
    const w = Math.max(currentBox.w, minSize);
    const h = Math.max(currentBox.h, minSize);
    const x = currentBox.x;
    const y = currentBox.y;

    if (activeTool === 'whiteout') {
      // REMOVE IMAGE / ELEMENT:
      // Instantly adds a clean whiteout block over the spider/unwanted element!
      onAddAnnotation({
        pageNumber: currentPage,
        type: 'whiteout',
        x,
        y,
        width: w,
        height: h,
        bgColor: '#ffffff',
      });
    } else if (activeTool === 'text') {
      onAddAnnotation({
        pageNumber: currentPage,
        type: 'text',
        x,
        y,
        width: Math.max(w, 20),
        height: Math.max(h, 6),
        text: 'Novo texto aqui',
        fontSize: 12,
        color: '#0f172a',
        bgColor: '#ffffff',
        fontWeight: 'normal',
      });
    } else if (activeTool === 'image') {
      // Trigger Image Selection Modal
      setPendingImageCoords({ x, y, w: Math.max(w, 25), h: Math.max(h, 20) });
      setShowImagePicker(true);
    } else if (activeTool === 'highlight') {
      onAddAnnotation({
        pageNumber: currentPage,
        type: 'highlight',
        x,
        y,
        width: w,
        height: h,
        bgColor: '#fde047',
      });
    } else if (activeTool === 'shape') {
      onAddAnnotation({
        pageNumber: currentPage,
        type: 'shape',
        shapeType: 'rectangle',
        x,
        y,
        width: w,
        height: h,
        strokeColor: '#4f46e5',
        strokeWidth: 2,
      });
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  // Image insertion selection handler
  const handleSelectImagePreset = (imgUrl: string, label: string) => {
    if (!pendingImageCoords) return;
    onAddAnnotation({
      pageNumber: currentPage,
      type: 'image',
      x: pendingImageCoords.x,
      y: pendingImageCoords.y,
      width: pendingImageCoords.w,
      height: pendingImageCoords.h,
      imageUrl: imgUrl,
      imageLabel: label,
      opacity: 1.0,
    });
    setShowImagePicker(false);
    setPendingImageCoords(null);
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pendingImageCoords || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onAddAnnotation({
        pageNumber: currentPage,
        type: 'image',
        x: pendingImageCoords.x,
        y: pendingImageCoords.y,
        width: pendingImageCoords.w,
        height: pendingImageCoords.h,
        imageUrl: result,
        imageLabel: file.name,
        opacity: 1.0,
      });
      setShowImagePicker(false);
      setPendingImageCoords(null);
    };
    reader.readAsDataURL(file);
  };

  // Dragging existing annotations
  const handleAnnotationMouseDown = (e: React.MouseEvent, ann: PageAnnotation) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;

    setSelectedId(ann.id);
    setIsDraggingSelected(true);
    const { x, y } = getPointerCanvasPercent(e);
    setDragOffset({ x: x - ann.x, y: y - ann.y });
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSelected && selectedId) {
      const { x, y } = getPointerCanvasPercent(e);
      const newX = Math.min(Math.max(x - dragOffset.x, 0), 95);
      const newY = Math.min(Math.max(y - dragOffset.y, 0), 95);
      onUpdateAnnotation(selectedId, { x: newX, y: newY });
    } else if (isDrawing) {
      handlePointerMove(e);
    }
  };

  const handleOverlayMouseUp = () => {
    setIsDraggingSelected(false);
    if (isDrawing) handlePointerUp();
  };

  // Theme filters
  const themeFilterClass =
    readingTheme === 'dark'
      ? 'invert contrast-125 hue-rotate-180 brightness-90'
      : readingTheme === 'sepia'
      ? 'sepia brightness-95'
      : '';

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center min-h-[600px] p-4 sm:p-8 select-none overflow-auto"
      onMouseMove={handleOverlayMouseMove}
      onMouseUp={handleOverlayMouseUp}
    >
      {/* Canvas container with drop shadow & borders */}
      <div
        className={`relative transition-all duration-150 shadow-2xl rounded-sm ${
          themeFilterClass ? 'overflow-hidden' : ''
        }`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Actual rendered PDF canvas */}
        <canvas
          ref={canvasRef}
          className={`block bg-white transition-filter ${themeFilterClass}`}
          onMouseDown={handlePointerDown}
        />

        {/* Interactive Annotation Overlay */}
        <div
          id="annotation-overlay"
          className="absolute inset-0 cursor-crosshair"
          style={{
            cursor:
              activeTool === 'select'
                ? 'default'
                : activeTool === 'pan'
                ? 'grab'
                : 'crosshair',
          }}
          onMouseDown={handlePointerDown}
        >
          {/* Render all annotations for current page */}
          {annotations.map((ann) => {
            const isSelected = selectedId === ann.id;

            return (
              <div
                key={ann.id}
                onMouseDown={(e) => handleAnnotationMouseDown(e, ann)}
                className={`absolute group transition-shadow ${
                  isSelected ? 'ring-2 ring-indigo-500 z-20' : 'z-10'
                }`}
                style={{
                  left: `${ann.x}%`,
                  top: `${ann.y}%`,
                  width: `${ann.width}%`,
                  height: `${ann.height}%`,
                }}
              >
                {/* 1. WHITEOUT (Remover Imagem / Ocultar Elemento) */}
                {ann.type === 'whiteout' && (
                  <div
                    className="w-full h-full relative"
                    style={{ backgroundColor: ann.bgColor || '#ffffff' }}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] transition text-[10px] text-white font-medium">
                      <span>Imagem Ocultada</span>
                    </div>
                  </div>
                )}

                {/* 2. IMAGE (Substituída ou Inserida) */}
                {ann.type === 'image' && ann.imageUrl && (
                  <div className="w-full h-full relative overflow-hidden rounded-sm">
                    <img
                      src={ann.imageUrl}
                      alt={ann.imageLabel || 'Imagem'}
                      className="w-full h-full object-contain"
                      style={{ opacity: ann.opacity !== undefined ? ann.opacity : 1 }}
                    />
                  </div>
                )}

                {/* 3. TEXT BLOCK */}
                {ann.type === 'text' && (
                  <div
                    onDoubleClick={() => {
                      setEditingTextId(ann.id);
                      setEditingTextVal(ann.text || '');
                    }}
                    className="w-full h-full p-1 leading-snug overflow-hidden flex flex-col justify-start"
                    style={{
                      backgroundColor: ann.bgColor || 'transparent',
                      color: ann.color || '#0f172a',
                      fontSize: `${ann.fontSize || 12}px`,
                      fontWeight: ann.fontWeight || 'normal',
                      fontStyle: ann.fontStyle || 'normal',
                    }}
                  >
                    {editingTextId === ann.id ? (
                      <textarea
                        autoFocus
                        value={editingTextVal}
                        onChange={(e) => setEditingTextVal(e.target.value)}
                        onBlur={() => {
                          onUpdateAnnotation(ann.id, { text: editingTextVal });
                          setEditingTextId(null);
                        }}
                        className="w-full h-full bg-white text-slate-900 p-1 rounded border border-indigo-500 text-xs resize-none outline-none"
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{ann.text}</span>
                    )}
                  </div>
                )}

                {/* 4. HIGHLIGHT */}
                {ann.type === 'highlight' && (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: ann.bgColor || '#fef08a',
                      opacity: 0.45,
                    }}
                  />
                )}

                {/* 5. SHAPE */}
                {ann.type === 'shape' && (
                  <div
                    className={`w-full h-full ${ann.shapeType === 'circle' ? 'rounded-full' : 'rounded-none'}`}
                    style={{
                      border: `${ann.strokeWidth || 2}px solid ${ann.strokeColor || '#4f46e5'}`,
                      backgroundColor: ann.fillColor || 'transparent',
                    }}
                  />
                )}

                {/* Selection Controls when item is active */}
                {isSelected && (
                  <div className="absolute -top-9 left-0 flex items-center space-x-1 bg-slate-900 text-white px-2 py-1 rounded-md shadow-lg border border-slate-700 text-xs">
                    {ann.type === 'text' && (
                      <button
                        onClick={() => {
                          setEditingTextId(ann.id);
                          setEditingTextVal(ann.text || '');
                        }}
                        className="p-1 hover:text-indigo-400"
                        title="Editar texto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteAnnotation(ann.id)}
                      className="p-1 hover:text-rose-400"
                      title="Excluir edição"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Currently drawing active box */}
          {isDrawing && currentBox && (
            <div
              className={`absolute border-2 pointer-events-none ${
                activeTool === 'whiteout'
                  ? 'border-rose-500 bg-white/70'
                  : activeTool === 'text'
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-emerald-500 bg-emerald-500/10'
              }`}
              style={{
                left: `${currentBox.x}%`,
                top: `${currentBox.y}%`,
                width: `${currentBox.w}%`,
                height: `${currentBox.h}%`,
              }}
            >
              <span className="absolute -top-5 left-0 px-1 py-0.5 rounded bg-slate-900 text-[10px] text-white">
                {activeTool === 'whiteout'
                  ? 'Remover Imagem / Ocultar'
                  : activeTool === 'text'
                  ? 'Novo Bloco de Texto'
                  : 'Área da Nova Imagem'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Image Insertion & Replacement Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Substituir / Inserir Imagem</h3>
              </div>
              <button
                onClick={() => {
                  setShowImagePicker(false);
                  setPendingImageCoords(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Escolha uma imagem para encaixar perfeitamente na página sem alterar as fontes ou a diagramação:
            </p>

            <div className="space-y-3">
              {/* Preset 1: Wolf Crest for RPG book */}
              <button
                onClick={() =>
                  handleSelectImagePreset(
                    generateWolfCrestPng(),
                    'Brasão do Lobo dos Montes Nevados'
                  )
                }
                className="w-full flex items-center space-x-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition group"
              >
                <div className="w-12 h-12 rounded-lg bg-indigo-950 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-indigo-300">
                    Brasão do Lobo Místico (Recomendado para RPG)
                  </div>
                  <div className="text-xs text-slate-400">
                    Substitui perfeitamente a imagem da aranha na página 5
                  </div>
                </div>
              </button>

              {/* Upload Custom Image */}
              <label className="w-full flex items-center space-x-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left cursor-pointer transition group">
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-indigo-300">
                    Fazer Upload de Imagem do Aparelho
                  </div>
                  <div className="text-xs text-slate-400">
                    Selecione qualquer foto, ilustração PNG ou JPG do seu celular ou PC
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleCustomImageUpload}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
