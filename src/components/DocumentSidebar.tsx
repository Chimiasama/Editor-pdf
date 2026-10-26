import React from 'react';
import type { TocItem } from '../types/pdf';
interface Props { isOpen: boolean; onClose: () => void; currentPage: number; tableOfContents: TocItem[]; onNavigateToPage: (page: number) => void }
export const DocumentSidebar: React.FC<Props> = ({ isOpen, onClose, tableOfContents, onNavigateToPage }) => !isOpen ? null : (
  <aside role="dialog" aria-label="Índice do documento" className="absolute inset-y-0 right-0 w-80 max-w-full bg-slate-900 border-l border-slate-700 z-30 overflow-auto p-4 shadow-2xl">
    <div className="flex justify-between items-center"><h2>Índice de capítulos</h2><button className="touch-button" onClick={onClose}>Fechar</button></div>
    {!tableOfContents.length && <p className="text-sm text-slate-400 my-4">Este PDF não contém marcadores de navegação.</p>}
    {tableOfContents.map(item => <button key={item.id} className="block w-full text-left p-3 my-2 bg-slate-800 rounded-xl" onClick={() => { onNavigateToPage(item.pageNumber); onClose(); }}>{item.title}<span className="block text-xs text-indigo-300">Página {item.pageNumber}</span></button>)}
  </aside>
);
