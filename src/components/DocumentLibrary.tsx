import React, { useRef, useState } from 'react';
import type { PdfDocumentRecord } from '../types/pdf';
interface Props {
  documents: PdfDocumentRecord[]; onSelectDocument: (id: string) => void;
  onToggleFavorite: (id: string, event: React.MouseEvent) => void;
  onDeleteDocument: (id: string, event: React.MouseEvent) => void;
  onCreateSampleRpg: () => void; onFileUpload: (file: File) => void | Promise<void>;
  isLoadingSample: boolean; storageStatus?: string;
}
export const DocumentLibrary: React.FC<Props> = p => {
  const [query, setQuery] = useState(''), [favorites, setFavorites] = useState(false), [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const docs = p.documents.filter(d => (!favorites || d.isFavorite) && d.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  async function open(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { alert('Escolha um arquivo PDF.'); return; }
    setImporting(true);
    try { await p.onFileUpload(file); } finally { setImporting(false); }
  }
  return <main className="min-h-dvh bg-slate-950 text-slate-100 p-4 sm:p-8" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void open(e.dataTransfer.files[0]); }}>
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="flex items-center gap-3"><div className="min-w-0 flex-1"><h1 className="font-bold text-2xl">EditPDF</h1><p className="text-sm text-slate-400">Seus documentos, neste aparelho.</p></div><button className="touch-button bg-indigo-600 text-white" disabled={importing} onClick={() => fileInput.current?.click()}>{importing ? 'Abrindo…' : 'Abrir PDF'}</button></header>
      <input aria-label="Abrir arquivo PDF" ref={fileInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { void open(e.target.files?.[0]); e.target.value = ''; }}/>
      <section className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-sm space-y-2">
        <p><strong>PDF:</strong> leia, marque e faça correções visuais mantendo a página original.</p>
        <p><strong>Documento:</strong> converta o texto para digitar e formatar livremente. O layout será reorganizado.</p>
      </section>
      <div className="flex flex-wrap gap-2 items-center"><input aria-label="Buscar documentos" className="min-w-0 flex-1 bg-slate-900 rounded-xl border border-slate-700 p-3" placeholder="Buscar nos seus PDFs" value={query} onChange={e => setQuery(e.target.value)}/><button className={`touch-button ${favorites ? 'bg-amber-600' : 'bg-slate-800'}`} aria-pressed={favorites} onClick={() => setFavorites(!favorites)}>★ Favoritos</button></div>
      {p.storageStatus?.match(/Falha|Não foi/) && <p role="alert" className="bg-rose-950 text-rose-200 p-3 rounded-xl">{p.storageStatus}. Exporte seus arquivos antes de fechar o app.</p>}
      <p className="text-xs text-slate-400">{docs.length} documento(s) · Arquivos e rascunhos são salvos localmente. Exportar cria uma cópia; mantenha seus próprios backups.</p>
      {!docs.length && <section className="py-10 text-center space-y-4"><h2 className="font-semibold">{query || favorites ? 'Nenhum resultado' : 'Abra seu primeiro PDF'}</h2><p className="text-sm text-slate-400">Escolha um arquivo do aparelho ou experimente o livro de demonstração.</p><button className="touch-button border border-indigo-500 text-indigo-200" disabled={p.isLoadingSample} onClick={p.onCreateSampleRpg}>{p.isLoadingSample ? 'Criando…' : 'Carregar Livro de RPG Exemplo'}</button></section>}
      <ul className="space-y-3">{docs.map(doc => <li key={doc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-2">
        <button className="min-w-0 flex-1 text-left p-2" onClick={() => p.onSelectDocument(doc.id)}><h2 className="font-semibold break-words">{doc.title}</h2><p className="text-xs text-slate-400 mt-1">{doc.pageCount} páginas · {doc.fileSizeFormatted}{doc.documentContent ? ' · Rascunho editável' : ''}</p><span className="text-indigo-300 text-sm">Abrir documento →</span></button>
        <div className="flex flex-col"><button aria-label={`Favoritar ${doc.title}`} aria-pressed={doc.isFavorite} className={`touch-button ${doc.isFavorite ? 'text-amber-300' : 'text-slate-400'}`} onClick={e => p.onToggleFavorite(doc.id, e)}>★</button><button aria-label={`Excluir ${doc.title}`} className="touch-button text-rose-300" onClick={e => p.onDeleteDocument(doc.id, e)}>Excluir</button></div>
      </li>)}</ul>
      {!!docs.length && <button className="touch-button text-slate-400 text-sm" disabled={p.isLoadingSample} onClick={p.onCreateSampleRpg}>+ Livro de exemplo</button>}
    </div>
  </main>;
};
