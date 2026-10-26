import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPdfPage } from '../utils/pdfEngine';
function Thumbnail({ pdf, page, rotation }: { pdf: PDFDocumentProxy; page: number; rotation: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) setVisible(true); });
    if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const offscreen = document.createElement('canvas');
    renderPdfPage(pdf, page, offscreen, .2, rotation).then(() => {
      if (cancelled || !canvas.current) return;
      canvas.current.width = offscreen.width; canvas.current.height = offscreen.height;
      canvas.current.getContext('2d')?.drawImage(offscreen, 0, 0);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pdf, page, rotation, visible]);
  return <canvas ref={canvas} className="max-w-full max-h-44 mx-auto bg-white rounded" aria-label={`Miniatura da página ${page}`} />;
}
interface Props {
  isOpen: boolean; onClose: () => void; totalPages: number; currentPage: number;
  onSelectPage: (page: number) => void; onRotatePage: (page: number) => void;
  pageRotations: Record<number, number>; annotationsCount: Record<number, number>;
  pdfDoc: PDFDocumentProxy | null;
}
export const ThumbnailDrawer: React.FC<Props> = p => !p.isOpen ? null : <aside role="dialog" aria-label="Páginas do PDF" className="absolute inset-y-0 left-0 w-64 max-w-full bg-slate-900 border-r border-slate-700 z-30 shadow-2xl flex flex-col">
  <header className="flex items-center justify-between p-3"><h2>Páginas ({p.totalPages})</h2><button className="touch-button" onClick={p.onClose}>Fechar</button></header>
  <div className="overflow-auto p-3 space-y-3">{Array.from({ length: p.totalPages }, (_, i) => i + 1).map(page => <section key={page} className={`p-2 rounded-xl border ${page === p.currentPage ? 'border-indigo-400' : 'border-slate-700'}`}>
    <button className="block w-full" onClick={() => p.onSelectPage(page)}>{p.pdfDoc && <Thumbnail pdf={p.pdfDoc} page={page} rotation={p.pageRotations[page] || 0}/>}<span className="block text-sm mt-2">Página {page}</span></button>
    <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{p.annotationsCount[page] || 0} anotações</span><button className="touch-button text-xs" onClick={() => p.onRotatePage(page)}>Girar</button></div>
  </section>)}</div>
</aside>;
