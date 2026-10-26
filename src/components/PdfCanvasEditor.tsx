import React, { useRef, useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPdfPage } from '../utils/pdfEngine';
import { pageTextBlocks, type TextBlock } from '../utils/pdfText';
import { normalizeRotation, transformRect, type Rect } from '../utils/pageGeometry';
import { wrapText } from '../utils/textLayout';
import type { PageAnnotation, EditorTool } from '../types/pdf';
import { usePinchZoom } from '../utils/usePinchZoom';

interface Props {
  pdfDoc: PDFDocumentProxy | null; currentPage: number; scale: number; rotation: number;
  activeTool: EditorTool; annotations: PageAnnotation[];
  onAddAnnotation: (ann: Omit<PageAnnotation, 'id' | 'createdAt'>) => void;
  onUpdateAnnotation: (id: string, updates: Partial<PageAnnotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onZoomChange: (zoom: number) => void; onNavigateToPage: (page: number) => void;
  readingTheme: 'light' | 'dark' | 'sepia';
}
type Draft = Omit<PageAnnotation, 'id' | 'createdAt'> & { id?: string };
interface Gesture { pointerId: number; startX: number; startY: number; rect: Rect; id?: string; mode: 'create' | 'move' | 'resize' }
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const PdfCanvasEditor: React.FC<Props> = p => {
  const scrollRef = useRef<HTMLDivElement>(null), pageRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<Rect & { id?: string } | null>(null);
  const previewRef = useRef<typeof preview>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 800, rotation: 0 });
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<Rect | null>(null);
  const [fitText, setFitText] = useState(true);
  const selected = p.annotations.find(a => a.id === selectedId);
  const displayRotation = dimensions.rotation;
  const annotationRect = (ann: PageAnnotation) => transformRect(ann, ann.viewRotation ?? 0, displayRotation);
  usePinchZoom(scrollRef, { currentZoom: p.scale, onZoomChange: p.onZoomChange, minZoom: .25, maxZoom: 4, enabled: !draft && (p.activeTool === 'pan' || p.activeTool === 'select') });

  useEffect(() => { setSelectedId(null); setDraft(null); setBlocks([]); gesture.current = null; setPreview(null); }, [p.currentPage, p.pdfDoc]);
  useEffect(() => {
    if (!p.pdfDoc) return;
    let cancelled = false;
    setLoading(true); setError('');
    const temporary = document.createElement('canvas');
    (async () => {
      const page = await p.pdfDoc!.getPage(p.currentPage);
      const viewport = page.getViewport({ scale: p.scale, rotation: normalizeRotation(page.rotate + p.rotation) });
      await renderPdfPage(p.pdfDoc!, p.currentPage, temporary, p.scale, p.rotation);
      if (cancelled || !canvasRef.current) return;
      canvasRef.current.width = temporary.width; canvasRef.current.height = temporary.height;
      canvasRef.current.getContext('2d')!.drawImage(temporary, 0, 0);
      setDimensions({ width: viewport.width, height: viewport.height, rotation: normalizeRotation(page.rotate + p.rotation) });
    })().catch(e => { if (!cancelled) setError('Não foi possível renderizar: ' + e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [p.pdfDoc, p.currentPage, p.scale, p.rotation]);
  useEffect(() => {
    if (!p.pdfDoc || p.activeTool !== 'edit-text') return;
    let cancelled = false;
    pageTextBlocks(p.pdfDoc, p.currentPage).then(items => { if (!cancelled) setBlocks(items); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [p.pdfDoc, p.currentPage, p.activeTool]);

  function point(e: React.PointerEvent): [number, number] {
    const box = pageRef.current!.getBoundingClientRect();
    return [clamp((e.clientX - box.left) / box.width * 100, 0, 100), clamp((e.clientY - box.top) / box.height * 100, 0, 100)];
  }
  function start(e: React.PointerEvent, ann?: PageAnnotation, resize = false) {
    if (p.activeTool === 'pan' || draft || e.button !== 0) return;
    if (e.isPrimary === false) { gesture.current = null; setPreview(null); return; }
    if (p.activeTool === 'edit-text' && !ann) return;
    if (!ann && p.activeTool === 'select') { setSelectedId(null); return; }
    e.preventDefault(); e.stopPropagation();
    const [x, y] = point(e);
    if (ann) {
      if (p.activeTool !== 'select' && p.activeTool !== 'edit-text') return;
      setSelectedId(ann.id);
    }
    const rect = ann ? annotationRect(ann) : { x, y, width: 0, height: 0 };
    previewRef.current = null;
    gesture.current = { pointerId: e.pointerId, startX: x, startY: y, rect, id: ann?.id, mode: ann ? resize ? 'resize' : 'move' : 'create' };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const [x, y] = point(e);
    const dx = x - g.startX, dy = y - g.startY;
    let rect: Rect;
    if (g.mode === 'move') rect = { ...g.rect, x: clamp(g.rect.x + dx, 0, 100 - g.rect.width), y: clamp(g.rect.y + dy, 0, 100 - g.rect.height) };
    else if (g.mode === 'resize') rect = { ...g.rect, width: clamp(g.rect.width + dx, 2, 100 - g.rect.x), height: clamp(g.rect.height + dy, 2, 100 - g.rect.y) };
    else rect = { x: Math.min(x, g.startX), y: Math.min(y, g.startY), width: Math.abs(dx), height: Math.abs(dy) };
    previewRef.current = { ...rect, id: g.id }; setPreview(previewRef.current);
  }
  function finish(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    const box = previewRef.current || g.rect;
    previewRef.current = null; setPreview(null);
    if (g.id) {
      if (Math.abs(box.x - g.rect.x) + Math.abs(box.y - g.rect.y) + Math.abs(box.width - g.rect.width) + Math.abs(box.height - g.rect.height) > .2) {
        const original = p.annotations.find(a => a.id === g.id);
        p.onUpdateAnnotation(g.id, { ...box, viewRotation: displayRotation, sourceRegion: original?.sourceRegion ? transformRect(original.sourceRegion, original.viewRotation ?? 0, displayRotation) : undefined });
      }
      return;
    }
    const width = clamp(Math.max(box.width, p.activeTool === 'text' ? 45 : 12), 2, 100 - Math.min(box.x, 98));
    const height = clamp(Math.max(box.height, p.activeTool === 'text' ? 12 : 8), 2, 100 - Math.min(box.y, 98));
    const rect = { x: Math.min(box.x, 98), y: Math.min(box.y, 98), width, height };
    if (p.activeTool === 'text') { setDraft({ ...rect, type: 'text', text: '', fontSize: 14, color: '#172033', pageNumber: p.currentPage, viewRotation: displayRotation }); setFitText(true); }
    else if (p.activeTool === 'image') { setPendingImage(rect); imageInput.current?.click(); }
    else if (['whiteout', 'highlight', 'shape'].includes(p.activeTool)) p.onAddAnnotation({ ...rect, pageNumber: p.currentPage, type: p.activeTool as 'whiteout' | 'highlight' | 'shape', bgColor: p.activeTool === 'highlight' ? '#fde047' : '#ffffff', strokeColor: '#4f46e5', viewRotation: displayRotation });
  }
  function openText(ann: PageAnnotation) { setDraft({ ...ann, ...annotationRect(ann), viewRotation: displayRotation, sourceRegion: ann.sourceRegion ? transformRect(ann.sourceRegion, ann.viewRotation ?? 0, displayRotation) : undefined }); setFitText(false); }
  function correct(block: TextBlock) {
    const existing = p.annotations.find(a => a.sourceTextId === block.id);
    if (existing) { openText(existing); return; }
    setDraft({ ...block, width: Math.max(block.width, 15), height: Math.max(block.height, (block.fontSize * 1.25 + 8) / pageHeightPoints * 100), id: undefined, type: 'text', pageNumber: p.currentPage, sourceTextId: block.id, sourceRegion: { x: block.x, y: block.y, width: block.width, height: block.height }, fontSize: block.fontSize, color: '#172033', bgColor: '#ffffff', viewRotation: 0 });
    setFitText(true);
  }
  const pageWidthPoints = dimensions.width / p.scale, pageHeightPoints = dimensions.height / p.scale;
  function draftLayout(value: Draft) {
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
    context.font = `${value.fontStyle === 'italic' ? 'italic' : ''} ${value.fontWeight === 'bold' ? 'bold' : ''} ${value.fontSize || 12}px Arial`;
    const lines = wrapText(value.text || '', Math.max(1, value.width / 100 * pageWidthPoints - 8), text => context.measureText(text).width);
    return { lines, height: lines.length * (value.fontSize || 12) * 1.25 + 8 };
  }
  const layout = draft ? draftLayout(draft) : null;
  const overflow = !!draft && !!layout && layout.height > draft.height / 100 * pageHeightPoints;
  function applyText() {
    if (!draft) return;
    let value = { ...draft };
    if (fitText && layout) value.height = Math.max(value.height, layout.height / pageHeightPoints * 100);
    if (value.y + value.height > 100 || (!fitText && overflow)) { setError('O texto não cabe. Aumente a caixa, reduza a fonte ou use o modo Documento.'); return; }
    const { id, ...ann } = value;
    if (id) p.onUpdateAnnotation(id, ann); else p.onAddAnnotation(ann);
    setDraft(null); setError('');
  }
  async function image(file?: File) {
    if (!file) return;
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Use uma imagem PNG ou JPEG.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Use uma imagem de até 10 MB.');
      const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
      if (selected?.type === 'image' && !pendingImage) p.onUpdateAnnotation(selected.id, { imageUrl: data, imageLabel: file.name });
      else if (pendingImage) p.onAddAnnotation({ ...pendingImage, type: 'image', imageUrl: data, imageLabel: file.name, pageNumber: p.currentPage, viewRotation: displayRotation });
    } catch (e: any) { setError(e.message); } finally { setPendingImage(null); }
  }
  return <div ref={scrollRef} className="w-full h-full overflow-auto relative" style={{ touchAction: p.activeTool === 'pan' || p.activeTool === 'select' ? 'pan-x pan-y' : 'none' }}>
    {error && <div role="alert" className="sticky top-0 z-20 bg-rose-950 text-rose-100 p-3 text-sm">{error}<button onClick={() => setError('')} className="ml-3 underline">Fechar</button></div>}
    {loading && <p role="status" className="text-center p-2 text-sm text-slate-300">Carregando página…</p>}
    {p.activeTool === 'edit-text' && <p className="text-xs p-3 text-indigo-200">{displayRotation !== 0 ? 'Volte a página à orientação original sem rotação para selecionar trechos. Use o modo Documento para texto reorganizável.' : blocks.length ? 'Toque em um trecho. Para reorganizar parágrafos, abra Modo Documento.' : 'Nenhum texto selecionável nesta página. Pode ser um PDF digitalizado; OCR ainda não está disponível.'}</p>}
    <div className="p-4 min-w-fit min-h-full flex justify-center items-start" onTouchStart={e => { if (e.touches.length > 1) { gesture.current = null; previewRef.current = null; setPreview(null); } }}>
      <div ref={pageRef} className="relative shrink-0 bg-white shadow-xl" style={{ width: dimensions.width, height: dimensions.height }}
        onPointerDown={e => start(e)} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; previewRef.current = null; setPreview(null); }}>
        <canvas ref={canvasRef} className="block pointer-events-none" style={{ width: dimensions.width, height: dimensions.height, filter: p.readingTheme === 'dark' ? 'invert(1) hue-rotate(180deg)' : p.readingTheme === 'sepia' ? 'sepia(.6)' : undefined }}/>
        {p.activeTool === 'edit-text' && displayRotation === 0 && blocks.filter(b => !p.annotations.some(a => a.sourceTextId === b.id)).map(block => <button key={block.id} aria-label={`Corrigir: ${block.text}`} className="absolute border border-indigo-400/50 bg-indigo-500/5 hover:bg-indigo-500/20" style={{ left: `${block.x}%`, top: `${block.y}%`, width: `${block.width}%`, height: `${block.height}%` }} onPointerDown={e => e.stopPropagation()} onClick={() => correct(block)} />)}
        {p.annotations.map(ann => {
          const rect = preview?.id === ann.id ? preview : annotationRect(ann);
          const isSelected = selectedId === ann.id;
          const delta = normalizeRotation(displayRotation - (ann.viewRotation ?? 0));
          const pixelWidth = rect.width / 100 * dimensions.width, pixelHeight = rect.height / 100 * dimensions.height;
          const source = ann.sourceRegion ? transformRect(ann.sourceRegion, ann.viewRotation ?? 0, displayRotation) : null;
          return <React.Fragment key={ann.id}>
            {source && <div className="absolute pointer-events-none bg-white" style={{ left: `${source.x}%`, top: `${source.y}%`, width: `${source.width}%`, height: `${source.height}%` }} />}
            <div data-annotation={ann.id} className={`absolute ${isSelected ? 'ring-2 ring-indigo-500 z-10' : ''}`} style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.width}%`, height: `${rect.height}%`, touchAction: p.activeTool === 'pan' ? 'auto' : 'none', pointerEvents: p.activeTool === 'pan' ? 'none' : 'auto' }} onPointerDown={e => start(e, ann)} onDoubleClick={() => ann.type === 'text' && openText(ann)}>
              <div className="absolute" style={{ width: delta % 180 ? pixelHeight : pixelWidth, height: delta % 180 ? pixelWidth : pixelHeight, left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${delta}deg)` }}>
              {ann.type === 'text' && <div className="w-full h-full overflow-hidden whitespace-pre-wrap" style={{ padding: 4 * p.scale, background: ann.bgColor || 'transparent', color: ann.color || '#172033', font: `${ann.fontStyle || 'normal'} ${ann.fontWeight || 'normal'} ${(ann.fontSize || 12) * p.scale}px/1.25 Arial`, textAlign: ann.textAlign || 'left' }}>{ann.text}</div>}
              {ann.type === 'image' && <img draggable={false} alt={ann.imageLabel || 'Imagem adicionada'} src={ann.imageUrl} className="w-full h-full" style={{ opacity: ann.opacity ?? 1 }}/>}
              {ann.type === 'whiteout' && <div className="w-full h-full" style={{ background: ann.bgColor || '#fff' }}/ >}
              {ann.type === 'highlight' && <div className="w-full h-full" style={{ background: ann.bgColor || '#fde047', opacity: .45 }}/ >}
              {ann.type === 'shape' && <div className="w-full h-full border-2" style={{ borderColor: ann.strokeColor || '#4f46e5', borderRadius: ann.shapeType === 'circle' ? '50%' : 0 }}/ >}
              </div>
              {isSelected && <button aria-label="Redimensionar anotação" className="absolute -right-3 -bottom-3 w-8 h-8 rounded-full bg-indigo-600 text-white border-2 border-white" onPointerDown={e => start(e, ann, true)}>↘</button>}
            </div>
          </React.Fragment>;
        })}
        {preview && !preview.id && <div className="absolute border-2 border-indigo-500 bg-indigo-500/10 pointer-events-none" style={{ left: `${preview.x}%`, top: `${preview.y}%`, width: `${preview.width}%`, height: `${preview.height}%` }} />}
      </div>
    </div>
    {selected && !draft && <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-30 bg-slate-800 text-white rounded-xl shadow-lg border border-slate-600 flex p-1 gap-1">
      {selected.type === 'text' && <button className="touch-button" onClick={() => openText(selected)}>Editar texto</button>}
      {selected.type === 'image' && <button className="touch-button" onClick={() => { setPendingImage(null); imageInput.current?.click(); }}>Trocar imagem</button>}
      <button className="touch-button text-rose-300" onClick={() => { p.onDeleteAnnotation(selected.id); setSelectedId(null); }}>Excluir anotação</button>
      <button className="touch-button" onClick={() => setSelectedId(null)}>Fechar</button>
    </div>}
    {draft && <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-2" role="dialog" aria-modal="true" aria-label="Editar bloco de texto" onPointerDown={e => e.stopPropagation()}>
      <div className="w-full max-w-xl max-h-[90dvh] overflow-auto bg-slate-900 text-white rounded-2xl p-4 space-y-3">
        <h2 className="font-bold">{draft.sourceTextId ? 'Corrigir trecho do PDF' : 'Editar bloco de texto'}</h2>
        {draft.sourceTextId && <p className="text-xs text-amber-200">Correção visual sobre fundo branco. O texto original permanece no arquivo; não use para apagar informações sensíveis.</p>}
        <textarea aria-label="Texto do bloco" autoFocus rows={5} className="w-full bg-white text-slate-900 rounded-lg p-3 text-base" value={draft.text || ''} onChange={e => setDraft({ ...draft, text: e.target.value })}/>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm">Fonte <input aria-label="Tamanho do texto" className="w-16 bg-slate-800 p-2" type="number" min={6} max={72} value={draft.fontSize || 12} onChange={e => setDraft({ ...draft, fontSize: clamp(Number(e.target.value), 6, 72) })}/></label>
          <button className={`touch-button font-bold ${draft.fontWeight === 'bold' ? 'bg-indigo-600' : ''}`} onClick={() => setDraft({ ...draft, fontWeight: draft.fontWeight === 'bold' ? 'normal' : 'bold' })}>Negrito</button>
          <button className={`touch-button italic ${draft.fontStyle === 'italic' ? 'bg-indigo-600' : ''}`} onClick={() => setDraft({ ...draft, fontStyle: draft.fontStyle === 'italic' ? 'normal' : 'italic' })}>Itálico</button>
          <input type="color" aria-label="Cor do bloco" value={draft.color || '#172033'} onChange={e => setDraft({ ...draft, color: e.target.value })}/>
          <select aria-label="Alinhamento do bloco" className="bg-slate-800 p-2" value={draft.textAlign || 'left'} onChange={e => setDraft({ ...draft, textAlign: e.target.value as 'left' | 'center' | 'right' })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select>
        </div>
        <div className="flex gap-3"><label className="text-sm">Largura (%) <input aria-label="Largura do bloco" type="number" className="w-16 bg-slate-800 p-2" min={2} max={100 - draft.x} value={Math.round(draft.width)} onChange={e => setDraft({ ...draft, width: clamp(Number(e.target.value), 2, 100 - draft.x) })}/></label><label className="text-sm">Altura (%) <input aria-label="Altura do bloco" type="number" className="w-16 bg-slate-800 p-2" min={2} max={100 - draft.y} value={Math.round(draft.height)} onChange={e => setDraft({ ...draft, height: clamp(Number(e.target.value), 2, 100 - draft.y) })}/></label></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fitText} onChange={e => setFitText(e.target.checked)}/>Aumentar a caixa para caber o texto</label>
        <p className={`text-xs ${overflow && !fitText ? 'text-rose-300' : 'text-slate-300'}`}>{layout?.lines.length} linha(s). {overflow ? 'O texto precisa de mais altura. Pode sobrepor outros elementos; confira a página.' : 'Texto dentro da área estimada.'}</p>
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        <div className="flex justify-end gap-2"><button className="touch-button" onClick={() => { setDraft(null); setError(''); }}>Cancelar</button><button className="touch-button bg-indigo-600" onClick={applyText}>Aplicar texto</button></div>
      </div>
    </div>}
    <input className="hidden" ref={imageInput} aria-label="Selecionar imagem" type="file" accept="image/png,image/jpeg" onChange={e => { void image(e.target.files?.[0]); e.target.value = ''; }}/>
  </div>;
};
