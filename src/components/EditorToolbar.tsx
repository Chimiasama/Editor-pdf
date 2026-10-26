import React from 'react';
import { ArrowLeft, BookOpen, Download, Undo2, Redo2 } from 'lucide-react';
import type { EditorTool } from '../types/pdf';
interface EditorToolbarProps {
  documentTitle: string; currentPage: number; totalPages: number; scale: number;
  activeTool: EditorTool; onSelectTool: (tool: EditorTool) => void;
  onPageChange: (page: number) => void; onZoomChange: (zoom: number) => void;
  onRotatePage: () => void; onOpenCropModal: () => void;
  onToggleDocumentPanel: () => void; isDocumentPanelOpen: boolean;
  onToggleThumbnailDrawer: () => void; isThumbnailDrawerOpen: boolean;
  readingTheme: 'light' | 'dark' | 'sepia'; onToggleTheme: () => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  onExportPdf: () => void; isExporting: boolean; onBackToLibrary: () => void;
  onDocumentMode: () => void; saveStatus: string;
}
const tools: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: 'pan', label: 'Ler', hint: 'Deslize a página e use dois dedos para ampliar.' },
  { tool: 'edit-text', label: 'Corrigir texto', hint: 'Toque em um trecho destacado para corrigir visualmente. O original permanece sob a cobertura.' },
  { tool: 'text', label: '+ Texto', hint: 'Toque na página para adicionar texto. Arraste para definir a área.' },
  { tool: 'select', label: 'Selecionar', hint: 'Toque em uma anotação para editar, mover ou redimensionar.' },
  { tool: 'image', label: '+ Imagem', hint: 'Toque na página e escolha uma imagem do aparelho.' },
  { tool: 'highlight', label: 'Marcar', hint: 'Arraste sobre a região que deseja destacar.' },
  { tool: 'whiteout', label: 'Cobrir', hint: 'Cobertura visual: não apaga o conteúdo original nem dados sensíveis.' },
  { tool: 'shape', label: 'Forma', hint: 'Arraste para adicionar um retângulo.' },
];
export const EditorToolbar: React.FC<EditorToolbarProps> = p => <>
  <header className="shrink-0 bg-slate-900 text-white border-b border-slate-700 z-40">
    <div className="flex items-center gap-2 p-2">
      <button aria-label="Voltar à biblioteca" className="touch-button" onClick={p.onBackToLibrary}><ArrowLeft size={20} /></button>
      <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-semibold">{p.documentTitle}</h1><p role="status" className={`text-xs ${p.saveStatus.includes('Não') ? 'text-rose-300' : 'text-slate-400'}`}>{p.saveStatus}</p></div>
      <button className="touch-button" title="Desfazer" aria-label="Desfazer" disabled={!p.canUndo} onClick={p.onUndo}><Undo2 size={18} /></button>
      <button className="touch-button" title="Refazer" aria-label="Refazer" disabled={!p.canRedo} onClick={p.onRedo}><Redo2 size={18} /></button>
      <button className="touch-button bg-indigo-600" aria-label="Exportar PDF" disabled={p.isExporting} onClick={p.onExportPdf}><Download size={18}/><span className="hidden sm:inline">Exportar</span></button>
    </div>
    <div className="flex gap-1 px-2 pb-2 overflow-x-auto whitespace-nowrap items-center text-xs">
      <button className="touch-button text-indigo-200" onClick={p.onDocumentMode}><BookOpen size={16}/>Modo Documento</button>
      <button className="touch-button" aria-label="Página anterior" disabled={p.currentPage <= 1} onClick={() => p.onPageChange(p.currentPage - 1)}>‹</button>
      <span className="px-2">{p.currentPage} / {p.totalPages}</span>
      <button className="touch-button" aria-label="Próxima página" disabled={p.currentPage >= p.totalPages} onClick={() => p.onPageChange(p.currentPage + 1)}>›</button>
      <button className="touch-button" onClick={p.onToggleThumbnailDrawer}>Páginas</button>
      <button className="touch-button" onClick={p.onToggleDocumentPanel}>Índice</button>
      <button className="touch-button" aria-label="Diminuir zoom" onClick={() => p.onZoomChange(Math.max(0.25, p.scale - 0.15))}>−</button>
      <span>{Math.round(p.scale * 100)}%</span>
      <button className="touch-button" aria-label="Aumentar zoom" onClick={() => p.onZoomChange(Math.min(4, p.scale + 0.15))}>+</button>
      <button className="touch-button" onClick={p.onRotatePage}>Girar</button>
      <button className="touch-button" onClick={p.onOpenCropModal}>Recortar</button>
      <button className="touch-button" onClick={p.onToggleTheme}>Tema</button>
    </div>
  </header>
  <div className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-700 z-40 safe-bottom">
    <p className="text-xs text-slate-300 px-3 pt-2">{tools.find(t => t.tool === p.activeTool)?.hint}</p>
    <nav aria-label="Ferramentas de edição" className="flex overflow-x-auto p-2 gap-1">
      {tools.map(t => <button key={t.tool} aria-pressed={p.activeTool === t.tool} className={`touch-button shrink-0 text-xs ${p.activeTool === t.tool ? 'bg-indigo-600 text-white' : 'text-slate-300'}`} onClick={() => p.onSelectTool(t.tool)}>{t.label}</button>)}
    </nav>
  </div>
</>;
