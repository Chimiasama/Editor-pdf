/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  PdfDocumentRecord,
  PageAnnotation,
  PageMetadata,
  AnnotationType,
  EditorTool,
} from './types/pdf';
import { createSampleRpgPdf } from './utils/samplePdfGenerator';
import { loadPdfJsDocument, exportEditedPdf, downloadFile } from './utils/pdfEngine';
import { DocumentLibrary } from './components/DocumentLibrary';
import { EditorToolbar } from './components/EditorToolbar';
import { PdfCanvasEditor } from './components/PdfCanvasEditor';
import { DocumentSidebar } from './components/DocumentSidebar';
import { ThumbnailDrawer } from './components/ThumbnailDrawer';
import { CropModal } from './components/CropModal';
import { DocumentEditor } from './components/DocumentEditor';
import * as store from './utils/documentStore';
import { readOutline } from './utils/pdfText';
import { createHistory, recordEdit, undoEdit, redoEdit, type EditHistory } from './utils/editHistory';

// Storage key for documents list
const STORAGE_DOCS_KEY = 'pdf_studio_documents_v1';

export default function App() {
  const [documents, setDocuments] = useState<PdfDocumentRecord[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // In-memory binary cache for active PDF document
  const pdfBytesCache = useRef<Record<string, Uint8Array>>({});

  // Active Document State
  const activeDoc = documents.find((d) => d.id === activeDocId) || null;
  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);
  const [activeTool, setActiveTool] = useState<EditorTool>('pan');
  const [readingTheme, setReadingTheme] = useState<'light' | 'dark' | 'sepia'>('light');

  // UI Panels
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState<boolean>(false);
  const [isThumbnailDrawerOpen, setIsThumbnailDrawerOpen] = useState<boolean>(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const documentsRef = useRef<PdfDocumentRecord[]>([]);
  const histories = useRef<Record<string, EditHistory<Record<number, PageMetadata>>>>({});
  const [isReady, setIsReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Carregando biblioteca…');
  const [mode, setMode] = useState<'pdf' | 'document'>('pdf');
  const saveQueue = useRef(Promise.resolve());
  const saveVersion = useRef(0);
  const activeHistory = activeDoc ? histories.current[activeDoc.id] : undefined;

  // Status Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved = await store.listDocuments();
      if (!saved.length) {
        const legacy = JSON.parse(localStorage.getItem(STORAGE_DOCS_KEY) || '[]');
        if (Array.isArray(legacy)) {
          saved = legacy;
          for (const doc of saved) await store.saveDocument(doc);
          localStorage.removeItem(STORAGE_DOCS_KEY);
        }
      }
      if (!cancelled) {
        documentsRef.current = saved;
        setDocuments(saved);
        setSaveStatus('Salvo no aparelho');
        setIsReady(true);
      }
    })().catch(error => {
      if (!cancelled) { setSaveStatus('Falha ao abrir armazenamento: ' + error.message); setIsReady(true); }
    });
    return () => { cancelled = true; };
  }, []);

  const syncDocumentsToStorage = (updatedDocs: PdfDocumentRecord[]) => {
    const previous = documentsRef.current;
    documentsRef.current = updatedDocs;
    setDocuments(updatedDocs);
    const changed = updatedDocs.filter(doc => previous.find(old => old.id === doc.id) !== doc);
    const version = ++saveVersion.current;
    setSaveStatus('Salvando…');
    const operation = saveQueue.current.then(async () => {
      for (const doc of changed) await store.saveDocument(doc);
    });
    saveQueue.current = operation.catch(() => {});
    operation.then(() => { if (version === saveVersion.current) setSaveStatus('Salvo no aparelho'); }).catch(error => setSaveStatus('Não foi salvo: ' + error.message));
  };

  // Helper to generate Sample RPG Book
  const handleCreateSampleRpg = async (isInitial = false) => {
    setIsLoadingSample(true);
    try {
      const { bytes, dataUri } = await createSampleRpgPdf();
      const newDocId = `doc-rpg-${Date.now()}`;
      pdfBytesCache.current[newDocId] = bytes;

      const newDoc: PdfDocumentRecord = {
        id: newDocId,
        title: 'Crônicas de Eldoria - Livro de Regras do Aventureiro (RPG).pdf',
        fileSizeFormatted: '1.2 MB',
        pageCount: 5,
        isFavorite: true,
        category: 'RPG',
        lastOpenedAt: Date.now(),
        createdAt: Date.now(),
        pdfDataUri: dataUri,
        tableOfContents: [
          {
            id: 'toc-1',
            title: 'Capítulo 1: Introdução & Regras Básicas',
            pageNumber: 2,
            category: 'Regras',
            description: 'Conceito do jogo, testes de atributos e rolagens de d20',
          },
          {
            id: 'toc-2',
            title: 'Capítulo 2: Criação de Personagens',
            pageNumber: 3,
            category: 'Personagens',
            description: 'Guerreiro, Mago, Ladino e modificadores',
          },
          {
            id: 'toc-3',
            title: 'Capítulo 3: Equipamentos & Armas',
            pageNumber: 4,
            category: 'Itens',
            description: 'Tabela de armas, armaduras, escudos e poções',
          },
          {
            id: 'toc-4',
            title: 'Capítulo 4: Bestiário & Perigos',
            pageNumber: 5,
            category: 'Monstros',
            description: 'Aranha gigante das cavernas e ameaças',
          },
        ],
        pageMetadata: {},
      };

      await store.saveDocument(newDoc, bytes);
      const updated = [newDoc, ...documentsRef.current.filter((d) => d.id !== newDocId)];
      syncDocumentsToStorage(updated);
      setMode('pdf');
      setActiveDocId(newDocId);

      if (!isInitial) {
        showToast('Livro de exemplo criado');
      }
    } catch (err: any) {
      console.error('Failed to create sample RPG:', err);
      alert('Erro ao criar documento de teste: ' + err.message);
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Upload custom PDF file from device
  const handleFileUpload = async (file: File) => {
    try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const newDocId = `doc-upload-${Date.now()}`;
    pdfBytesCache.current[newDocId] = bytes;

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const dataUri = URL.createObjectURL(blob);

      const tempPdf = await loadPdfJsDocument(bytes);
      const pageCount = tempPdf.numPages;

      const newDoc: PdfDocumentRecord = {
        id: newDocId,
        title: file.name,
        fileSizeFormatted: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        pageCount: pageCount,
        isFavorite: false,
        lastOpenedAt: Date.now(),
        createdAt: Date.now(),
        pdfDataUri: dataUri,
        tableOfContents: await readOutline(tempPdf),
        pageMetadata: {},
      };

      await store.saveDocument(newDoc, bytes);
      await tempPdf.loadingTask.destroy();
      const updated = [newDoc, ...documentsRef.current];
      syncDocumentsToStorage(updated);
      setMode('pdf');
      setActiveDocId(newDocId);
      showToast(`PDF "${file.name}" carregado com sucesso!`);
    } catch (e: any) {
      alert('Não foi possível ler o arquivo PDF: ' + e.message);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = documentsRef.current.map((d) => (d.id === docId ? { ...d, isFavorite: !d.isFavorite } : d));
    syncDocumentsToStorage(updated);
  };

  // Delete Document
  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este PDF da lista?')) {
      try { await saveQueue.current; await store.deleteStoredDocument(docId); } catch (error) { alert('Não foi possível excluir o arquivo.'); return; }
      const updated = documentsRef.current.filter((d) => d.id !== docId);
      delete pdfBytesCache.current[docId];
      syncDocumentsToStorage(updated);
      if (activeDocId === docId) {
        setActiveDocId(null);
      }
    }
  };

  // Load PDF into PDF.js proxy when active document changes
  useEffect(() => {
    if (!activeDocId) {
      setPdfProxy(null);
      return;
    }

    let isMounted = true;
    let loaded: pdfjsLib.PDFDocumentProxy | undefined;
    setPdfProxy(null);
    setCurrentPage(1);
    setActiveTool('pan');
    setIsDocumentPanelOpen(false);
    setIsThumbnailDrawerOpen(false);
    (async () => {
      const bytes = pdfBytesCache.current[activeDocId] ?? await store.readDocumentBytes(activeDocId);
      if (!bytes) throw new Error('Arquivo antigo não está salvo. Importe novamente pelo botão Abrir PDF.');
      pdfBytesCache.current[activeDocId] = bytes;
      const proxy = await loadPdfJsDocument(bytes);
      loaded = proxy;
      if (isMounted) {
        setPdfProxy(proxy);
        const page = await proxy.getPage(1);
        const available = Math.max(240, window.innerWidth - 32);
        setScale(Math.min(1.25, available / page.getViewport({ scale: 1 }).width));
      } else await proxy.loadingTask.destroy();
    })().catch(error => { if (isMounted) showToast(error.message); });
    return () => { isMounted = false; if (loaded) void loaded.loadingTask.destroy(); };
  }, [activeDocId]);

  // Current page metadata & annotations
  const currentPageMeta = activeDoc?.pageMetadata[currentPage] || {
    pageNumber: currentPage,
    rotation: 0,
    annotations: [],
  };

  const updatePageMetadata = (updater: (prev: Record<number, PageMetadata>) => Record<number, PageMetadata>) => {
    if (!activeDocId) return;
    const doc = documentsRef.current.find(d => d.id === activeDocId);
    if (!doc) return;
    const next = updater(doc.pageMetadata || {});
    histories.current[doc.id] = recordEdit(histories.current[doc.id] || createHistory(doc.pageMetadata || {}), next);
    syncDocumentsToStorage(documentsRef.current.map(d => d.id === doc.id ? { ...d, pageMetadata: next, lastOpenedAt: Date.now() } : d));
  };
  const travelHistory = (direction: 'undo' | 'redo') => {
    if (!activeDocId) return;
    const history = histories.current[activeDocId];
    if (!history) return;
    const next = direction === 'undo' ? undoEdit(history) : redoEdit(history);
    histories.current[activeDocId] = next;
    syncDocumentsToStorage(documentsRef.current.map(d => d.id === activeDocId ? { ...d, pageMetadata: next.present } : d));
  };
  const handleUndo = () => travelHistory('undo');
  const handleRedo = () => travelHistory('redo');

  // Add Annotation to current page
  const handleAddAnnotation = (ann: Omit<PageAnnotation, 'id' | 'createdAt'>) => {
    const newId = `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const fullAnnotation: PageAnnotation = {
      ...ann,
      id: newId,
      createdAt: Date.now(),
    };

    updatePageMetadata((prev) => {
      const currentMeta = prev[ann.pageNumber] || {
        pageNumber: ann.pageNumber,
        rotation: 0,
        annotations: [],
      };
      return {
        ...prev,
        [ann.pageNumber]: {
          ...currentMeta,
          annotations: [...currentMeta.annotations, fullAnnotation],
        },
      };
    });

    if (ann.type === 'whiteout') {
      showToast('Região coberta visualmente. O conteúdo original continua no PDF.');
    } else if (ann.type === 'image') {
      showToast('Imagem adicionada');
    }
  };

  // Update Annotation
  const handleUpdateAnnotation = (id: string, updates: Partial<PageAnnotation>) => {
    updatePageMetadata((prev) => {
      const currentMeta = prev[currentPage];
      if (!currentMeta) return prev;
      return {
        ...prev,
        [currentPage]: {
          ...currentMeta,
          annotations: currentMeta.annotations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        },
      };
    });
  };

  // Delete Annotation
  const handleDeleteAnnotation = (id: string) => {
    updatePageMetadata((prev) => {
      const currentMeta = prev[currentPage];
      if (!currentMeta) return prev;
      return {
        ...prev,
        [currentPage]: {
          ...currentMeta,
          annotations: currentMeta.annotations.filter((a) => a.id !== id),
        },
      };
    });
    showToast('Edição removida');
  };

  // Rotate Page (90 deg clockwise)
  const handleRotatePage = (targetPage?: number) => {
    const pageNum = targetPage || currentPage;
    updatePageMetadata((prev) => {
      const currentMeta = prev[pageNum] || {
        pageNumber: pageNum,
        rotation: 0,
        annotations: [],
      };
      return {
        ...prev,
        [pageNum]: {
          ...currentMeta,
          rotation: (currentMeta.rotation + 90) % 360,
        },
      };
    });
    showToast(`Página ${pageNum} girada 90°`);
  };

  // Apply Crop / Enquadramento
  const handleApplyCrop = (crop: { top: number; bottom: number; left: number; right: number }) => {
    updatePageMetadata((prev) => {
      const currentMeta = prev[currentPage] || {
        pageNumber: currentPage,
        rotation: 0,
        annotations: [],
      };
      return {
        ...prev,
        [currentPage]: {
          ...currentMeta,
          cropBox: crop,
        },
      };
    });
    showToast(`Enquadramento aplicado na Página ${currentPage}`);
  };

  // Export / Download edited PDF
  const handleExportPdf = async () => {
    if (!activeDoc) return;
    setIsExporting(true);
    try {
      const originalBytes = pdfBytesCache.current[activeDoc.id];
      if (!originalBytes) {
        throw new Error('Bytes originais do PDF não encontrados no cache.');
      }

      const editedBytes = await exportEditedPdf(
        originalBytes,
        activeDoc.pageMetadata || {},
        activeDoc.title
      );

      // Trigger download
      const cleanFileName = activeDoc.title.replace('.pdf', '') + '_editado.pdf';
      await downloadFile(editedBytes, cleanFileName);
      showToast('Cópia editada exportada');
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Erro ao exportar PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Quick stats for thumbnails drawer
  const pageRotations = Object.entries(activeDoc?.pageMetadata || {}).reduce(
    (acc, [pg, meta]) => {
      acc[Number(pg)] = meta.rotation;
      return acc;
    },
    {} as Record<number, number>
  );

  const annotationsCount = Object.entries(activeDoc?.pageMetadata || {}).reduce(
    (acc, [pg, meta]) => {
      acc[Number(pg)] = meta.annotations?.length || 0;
      return acc;
    },
    {} as Record<number, number>
  );

  if (!isReady) return <div className="p-8 text-white">Carregando biblioteca…</div>;

  // VIEW 1: DOCUMENT LIBRARY
  if (!activeDocId || !activeDoc) {
    return (
      <DocumentLibrary
        storageStatus={saveStatus}
        documents={documents}
        onSelectDocument={(id) => { setMode('pdf'); setActiveDocId(id); }}
        onToggleFavorite={handleToggleFavorite}
        onDeleteDocument={handleDeleteDocument}
        onCreateSampleRpg={() => handleCreateSampleRpg(false)}
        onFileUpload={handleFileUpload}
        isLoadingSample={isLoadingSample}
      />
    );
  }

  if (mode === 'document') return <DocumentEditor key={activeDoc.id} document={activeDoc} pdfDoc={pdfProxy}
    onBack={() => setMode('pdf')} onChange={content => syncDocumentsToStorage(documentsRef.current.map(d => d.id === activeDoc.id ? { ...d, documentContent: content } : d))} saveStatus={saveStatus} />;

  // VIEW 2: PDF VIEWER & EDITOR WORKSPACE
  return (
    <div className="h-dvh w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Toolbar */}
      <EditorToolbar
        onDocumentMode={() => setMode('document')}
        saveStatus={saveStatus}
        documentTitle={activeDoc.title}
        currentPage={currentPage}
        totalPages={activeDoc.pageCount}
        scale={scale}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onPageChange={setCurrentPage}
        onZoomChange={setScale}
        onRotatePage={() => handleRotatePage()}
        onOpenCropModal={() => setIsCropModalOpen(true)}
        onToggleDocumentPanel={() => setIsDocumentPanelOpen(!isDocumentPanelOpen)}
        isDocumentPanelOpen={isDocumentPanelOpen}
        onToggleThumbnailDrawer={() => setIsThumbnailDrawerOpen(!isThumbnailDrawerOpen)}
        isThumbnailDrawerOpen={isThumbnailDrawerOpen}
        readingTheme={readingTheme}
        onToggleTheme={() =>
          setReadingTheme(readingTheme === 'light' ? 'dark' : readingTheme === 'dark' ? 'sepia' : 'light')
        }
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={!!activeHistory?.past.length}
        canRedo={!!activeHistory?.future.length}
        onExportPdf={handleExportPdf}
        isExporting={isExporting}
        onBackToLibrary={() => setActiveDocId(null)}
      />

      {/* Main Workspace: Left Drawer (Thumbnails) + Center (PDF Canvas) + Right Drawer (Document Sidebar) */}
      <div className="flex-1 flex overflow-hidden relative mb-28">
        {/* Left Drawer: Page Thumbnails */}
        <ThumbnailDrawer
          pdfDoc={pdfProxy}
          isOpen={isThumbnailDrawerOpen}
          onClose={() => setIsThumbnailDrawerOpen(false)}
          totalPages={activeDoc.pageCount}
          currentPage={currentPage}
          onSelectPage={(pg) => {
            setCurrentPage(pg);
            setIsThumbnailDrawerOpen(false);
          }}
          onRotatePage={handleRotatePage}
          pageRotations={pageRotations}
          annotationsCount={annotationsCount}
        />

        {/* Center: Interactive PDF Canvas Viewport */}
        <div className="flex-1 overflow-auto bg-slate-950 flex flex-col items-center justify-start relative">
          <PdfCanvasEditor
            pdfDoc={pdfProxy}
            currentPage={currentPage}
            scale={scale}
            rotation={currentPageMeta.rotation || 0}
            activeTool={activeTool}
            annotations={currentPageMeta.annotations || []}
            onAddAnnotation={handleAddAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            onZoomChange={setScale}
            onNavigateToPage={setCurrentPage}
            readingTheme={readingTheme}
          />
        </div>

        {/* Right Drawer: Document Sidebar */}
        <DocumentSidebar
          isOpen={isDocumentPanelOpen}
          onClose={() => setIsDocumentPanelOpen(false)}
          currentPage={currentPage}
          tableOfContents={activeDoc.tableOfContents || []}
          onNavigateToPage={(pg) => setCurrentPage(pg)}
        />
      </div>

      {/* Crop / Enquadramento Modal */}
      <CropModal
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        currentPage={currentPage}
        initialCrop={currentPageMeta.cropBox}
        onApplyCrop={handleApplyCrop}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-indigo-500/50 text-white text-xs font-semibold shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
