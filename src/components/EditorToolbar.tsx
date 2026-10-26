import React from 'react';
import {
  ArrowLeft,
  MousePointer,
  Type,
  Eraser,
  Image as ImageIcon,
  Highlighter,
  Square,
  RotateCw,
  Crop,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  Sun,
  Moon,
  BookOpen,
  Undo2,
  Redo2,
  Columns
} from 'lucide-react';
import { AnnotationType } from '../types/pdf';

interface EditorToolbarProps {
  documentTitle: string;
  currentPage: number;
  totalPages: number;
  scale: number;
  activeTool: AnnotationType | 'select' | 'pan';
  onSelectTool: (tool: AnnotationType | 'select' | 'pan') => void;
  onPageChange: (newPage: number) => void;
  onZoomChange: (newZoom: number) => void;
  onRotatePage: () => void;
  onOpenCropModal: () => void;
  onToggleAiPanel: () => void;
  isAiPanelOpen: boolean;
  onToggleThumbnailDrawer: () => void;
  isThumbnailDrawerOpen: boolean;
  readingTheme: 'light' | 'dark' | 'sepia';
  onToggleTheme: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExportPdf: () => void;
  isExporting: boolean;
  onBackToLibrary: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  documentTitle,
  currentPage,
  totalPages,
  scale,
  activeTool,
  onSelectTool,
  onPageChange,
  onZoomChange,
  onRotatePage,
  onOpenCropModal,
  onToggleAiPanel,
  isAiPanelOpen,
  onToggleThumbnailDrawer,
  isThumbnailDrawerOpen,
  readingTheme,
  onToggleTheme,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportPdf,
  isExporting,
  onBackToLibrary,
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-200 sticky top-0 z-40 select-none shadow-md">
      {/* Top Header Row */}
      <div className="px-3 sm:px-6 h-14 flex items-center justify-between border-b border-slate-800/80 gap-2">
        {/* Left: Back button & Document Title */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            onClick={onBackToLibrary}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center space-x-1"
            title="Voltar para a biblioteca de PDFs"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden md:inline text-xs font-semibold">Biblioteca</span>
          </button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          <button
            onClick={onToggleThumbnailDrawer}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              isThumbnailDrawerOpen ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title="Exibir miniaturas de páginas"
          >
            <Columns className="w-4 h-4" />
            <span className="hidden lg:inline">Páginas</span>
          </button>

          <div className="min-w-0 truncate">
            <h2 className="text-sm font-semibold text-white truncate max-w-[150px] sm:max-w-xs md:max-w-md">
              {documentTitle}
            </h2>
          </div>
        </div>

        {/* Center: Page Navigation */}
        <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-950/70 px-2 py-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-medium text-slate-300 px-1">
            <span className="text-indigo-400 font-bold">{currentPage}</span> / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
            title="Próxima página"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: AI Panel, Theme & Export */}
        <div className="flex items-center space-x-2">
          {/* Reading theme toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={`Tema de Leitura: ${readingTheme === 'light' ? 'Claro' : readingTheme === 'dark' ? 'Noturno' : 'Sépia'}`}
          >
            {readingTheme === 'dark' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : readingTheme === 'sepia' ? (
              <BookOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <Sun className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* AI Gemini Button */}
          <button
            onClick={onToggleAiPanel}
            className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              isAiPanelOpen
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-400/50 shadow-md shadow-indigo-500/20'
                : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 hover:bg-indigo-900/40'
            }`}
            title="Abrir Assistente de IA Gemini (Índice inteligente, correção e remoção)"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">IA Gemini</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          {/* Export / Download */}
          <button
            onClick={onExportPdf}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
            title="Salvar alterações e baixar PDF perfeito"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isExporting ? 'Salvando...' : 'Baixar PDF'}</span>
            <span className="sm:hidden">Baixar</span>
          </button>
        </div>
      </div>

      {/* Editing Toolbar Row */}
      <div className="px-3 sm:px-6 py-2 flex items-center justify-between overflow-x-auto gap-3 text-xs scrollbar-none">
        {/* Core Tool Selection */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onSelectTool('select')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTool === 'select'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Selecionar e mover elementos"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Mover / Seleção</span>
          </button>

          <button
            onClick={() => onSelectTool('text')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTool === 'text'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Editar ou adicionar texto mantendo diagramação"
          >
            <Type className="w-3.5 h-3.5 text-blue-400" />
            <span>Editar Texto</span>
          </button>

          {/* REMOVER IMAGEM / WHITEOUT - Highlighted prominently as requested by the user! */}
          <button
            onClick={() => onSelectTool('whiteout')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              activeTool === 'whiteout'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-rose-500/20'
            }`}
            title="Remover ou ocultar qualquer imagem indesejada (como a aranha) com fundo limpo"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Remover Imagem</span>
          </button>

          <button
            onClick={() => onSelectTool('image')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTool === 'image'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Substituir ou inserir nova imagem/brasão"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Substituir Imagem</span>
          </button>

          <button
            onClick={() => onSelectTool('highlight')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTool === 'highlight'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Marca-texto / Destacar frases"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Marca-texto</span>
          </button>

          <button
            onClick={() => onSelectTool('shape')}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg font-medium transition ${
              activeTool === 'shape'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Inserir moldura ou forma"
          >
            <Square className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Forma</span>
          </button>
        </div>

        {/* Diagramation & Enquadramento */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={onRotatePage}
            className="flex items-center space-x-1 px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Girar página 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Girar</span>
          </button>

          <button
            onClick={onOpenCropModal}
            className="flex items-center space-x-1 px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Ajustar enquadramento e margens (Crop)"
          >
            <Crop className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Enquadramento</span>
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
            title="Desfazer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition"
            title="Refazer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onZoomChange(Math.max(scale - 0.15, 0.5))}
            className="p-1 rounded text-slate-400 hover:text-white transition"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-semibold text-slate-300 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => onZoomChange(Math.min(scale + 0.15, 3.0))}
            className="p-1 rounded text-slate-400 hover:text-white transition"
            title="Aumentar Zoom (ou use pinçar no celular)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onZoomChange(1.0)}
            className="p-1 rounded text-slate-400 hover:text-white transition"
            title="Tamanho Real (100%)"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
