import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TextStyleKit } from '@tiptap/extension-text-style';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfDocumentRecord } from '../types/pdf';
import { downloadFile } from '../utils/pdfEngine';
import { exportDocument } from '../utils/documentExport';

const ResizableImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), width: { default: null, parseHTML: element => element.getAttribute('width'),
      renderHTML: attrs => attrs.width ? { width: attrs.width, style: `width: ${attrs.width}px; max-width: 100%; height: auto` } : {} } };
  },
});
interface Props { document: PdfDocumentRecord; pdfDoc: PDFDocumentProxy | null; onBack: () => void; onChange: (content: JSONContent) => void; saveStatus: string }
export function DocumentEditor({ document, pdfDoc, onBack, onChange, saveStatus }: Props) {
  const [started, setStarted] = useState(!!document.documentContent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, refresh] = useState(0);
  const upload = useRef<HTMLInputElement>(null);
  const editor = useEditor({ extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, codeBlock: false }), TextAlign.configure({ types: ['heading', 'paragraph'] }), TextStyleKit, ResizableImage.configure({ allowBase64: true })],
    content: document.documentContent || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: { attributes: { class: 'document-prose', 'aria-label': 'Conteúdo do documento', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()), onTransaction: () => refresh(v => v + 1),
  });
  async function convert() {
    if (!pdfDoc || !editor) return;
    setBusy(true); setError('');
    try {
      const content: JSONContent[] = [];
      for (let n = 1; n <= pdfDoc.numPages; n++) {
        const page = await pdfDoc.getPage(n);
        const text = await page.getTextContent();
        let line = '';
        for (const item of text.items) {
          if (!('str' in item)) continue;
          line += item.str + ' ';
          if (item.hasEOL && line.trim()) { content.push({ type: 'paragraph', content: [{ type: 'text', text: line.trim() }] }); line = ''; }
        }
        if (line.trim()) content.push({ type: 'paragraph', content: [{ type: 'text', text: line.trim() }] });
      }
      if (!content.length) throw new Error('Não há texto selecionável neste PDF. PDFs digitalizados precisam de OCR, ainda indisponível.');
      const result = { type: 'doc', content };
      editor.commands.setContent(result); onChange(result); setStarted(true);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function save() {
    if (!editor) return;
    setBusy(true); setError('');
    try { await downloadFile(await exportDocument(editor.getJSON()), document.title.replace(/\.pdf$/i, '') + '_documento.pdf'); }
    catch (e: any) { setError('Não foi possível exportar: ' + e.message); } finally { setBusy(false); }
  }
  async function addImage(file?: File) {
    if (!file || !editor) return;
    setError('');
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Escolha PNG ou JPEG.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Use uma imagem de até 10 MB.');
      const reader = new FileReader();
      reader.onload = () => editor.chain().focus().setImage({ src: String(reader.result), alt: file.name }).run();
      reader.onerror = () => setError('Não foi possível abrir a imagem.');
      reader.readAsDataURL(file);
    } catch (e: any) { setError(e.message); }
  }
  return <div className="h-dvh flex flex-col bg-slate-100 text-slate-900">
    <header className="bg-slate-900 text-white shrink-0 p-2">
      <div className="flex items-center gap-2"><button className="touch-button" onClick={onBack}>← PDF</button><div className="min-w-0 flex-1"><h1 className="text-sm font-bold truncate">Modo Documento</h1><p role="status" className="text-xs text-slate-300">{saveStatus}</p></div>{started && <button className="touch-button bg-indigo-600" disabled={busy} onClick={save}>{busy ? 'Exportando…' : 'Exportar PDF'}</button>}</div>
      {started && editor && <div className="flex gap-1 overflow-x-auto items-center whitespace-nowrap" aria-label="Formatação do documento">
        <button aria-label="Desfazer texto" className="touch-button" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</button>
        <button aria-label="Refazer texto" className="touch-button" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</button>
        <select aria-label="Estilo do parágrafo" className="bg-slate-800 p-2 rounded" value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : 'p'} onChange={e => e.target.value === 'p' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: e.target.value === 'h1' ? 1 : 2 }).run()}><option value="p">Texto</option><option value="h1">Título</option><option value="h2">Subtítulo</option></select>
        <select aria-label="Tamanho da fonte" className="bg-slate-800 p-2 rounded" value={editor.getAttributes('textStyle').fontSize || '16px'} onChange={e => editor.chain().focus().setFontSize(e.target.value).run()}>{[12, 14, 16, 18, 24, 32].map(size => <option key={size} value={`${size}px`}>{size}</option>)}</select>
        <button aria-label="Negrito" aria-pressed={editor.isActive('bold')} className="touch-button font-bold" onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button aria-label="Itálico" aria-pressed={editor.isActive('italic')} className="touch-button italic" onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button aria-label="Sublinhado" aria-pressed={editor.isActive('underline')} className="touch-button underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
        <input type="color" aria-label="Cor do texto" value={editor.getAttributes('textStyle').color || '#172033'} onChange={e => editor.chain().focus().setColor(e.target.value).run()} />
        {(['left', 'center', 'right', 'justify'] as const).map((align, i) => <button className="touch-button" key={align} aria-pressed={editor.isActive({ textAlign: align })} onClick={() => editor.chain().focus().setTextAlign(align).run()}>{['Esquerda', 'Centro', 'Direita', 'Justificar'][i]}</button>)}
        <button className="touch-button" aria-pressed={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Lista</button>
        <button className="touch-button" aria-pressed={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Lista</button>
        <button className="touch-button" onClick={() => upload.current?.click()}>+ Imagem</button>
        {editor.isActive('image') && <><label>Largura <input aria-label="Largura da imagem" className="w-20 bg-slate-800 p-2" type="number" min={40} max={650} value={editor.getAttributes('image').width || 400} onChange={e => editor.chain().focus().updateAttributes('image', { width: Math.max(40, Math.min(650, Number(e.target.value))) }).run()}/></label><button className="touch-button text-rose-300" onClick={() => editor.chain().focus().deleteSelection().run()}>Excluir imagem</button></>}
      </div>}
    </header>
    {error && <p role="alert" className="p-3 bg-rose-100 text-rose-900">{error}</p>}
    {!started ? <section className="p-6 max-w-xl mx-auto space-y-4 overflow-auto">
      <h2 className="text-xl font-bold">Editar como um documento</h2>
      <p>Converta o texto selecionável em parágrafos editáveis. Digite, apague, formate e insira imagens; o novo PDF terá páginas reorganizadas automaticamente.</p>
      <p className="bg-amber-100 p-4 rounded-xl">A conversão não mantém o layout, tabelas nem imagens do PDF original. Correções feitas no modo PDF também não são importadas. O arquivo original e suas anotações continuam intactos.</p>
      <button className="touch-button bg-indigo-600 text-white" disabled={busy || !pdfDoc} onClick={convert}>{busy ? 'Convertendo…' : 'Converter texto do PDF'}</button>
      <button className="touch-button border border-slate-400" onClick={() => { setStarted(true); onChange(editor?.getJSON() || { type: 'doc', content: [{ type: 'paragraph' }] }); }}>Começar documento em branco</button>
    </section> : <main className="flex-1 overflow-auto p-3 sm:p-8"><div className="bg-white shadow rounded p-5 sm:p-12 max-w-4xl mx-auto"><EditorContent editor={editor}/></div><p className="text-xs text-center p-4 text-slate-500">O PDF será paginado em A4 ao exportar. Seu rascunho é salvo neste aparelho.</p></main>}
    <input ref={upload} className="hidden" type="file" accept="image/png,image/jpeg" onChange={e => { void addImage(e.target.files?.[0]); e.target.value = ''; }} />
  </div>;
}
