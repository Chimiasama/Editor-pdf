import React from 'react';
import { X } from 'lucide-react';
import { TocItem } from '../types/pdf';

interface DocumentSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  tableOfContents: TocItem[];
  onNavigateToPage: (page: number) => void;
  onQuickRemoveSpider: () => void;
  onQuickReplaceWithWolfCrest: () => void;
}

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  isOpen, onClose, currentPage, tableOfContents, onNavigateToPage,
  onQuickRemoveSpider, onQuickReplaceWithWolfCrest,
}) => {
  if (!isOpen) return null;
  return (
    <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-30 shadow-2xl">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Documento</h3>
        <button onClick={onClose} aria-label="Fechar painel do documento" className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        <h4 className="font-semibold text-indigo-300">Índice de capítulos</h4>
        {tableOfContents.length === 0 && <p className="text-slate-400">Este documento não possui capítulos cadastrados.</p>}
        {tableOfContents.map(item => (
          <button key={item.id} onClick={() => onNavigateToPage(item.pageNumber)} className="w-full text-left p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white">
            <span className="block font-semibold">{item.title}</span>
            <span className="text-indigo-300">Página {item.pageNumber}</span>
          </button>
        ))}
        {currentPage === 5 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-300">Ferramentas do livro de exemplo</h4>
            <button onClick={onQuickRemoveSpider} className="w-full p-2 rounded-lg bg-rose-600 text-white">Remover Aranha</button>
            <button onClick={onQuickReplaceWithWolfCrest} className="w-full p-2 rounded-lg bg-indigo-600 text-white">Colocar Brasão</button>
          </div>
        )}
      </div>
    </aside>
  );
};
