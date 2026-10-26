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
} from './types/pdf';
import { createSampleRpgPdf, generateWolfCrestPng } from './utils/samplePdfGenerator';
import { loadPdfJsDocument, exportEditedPdf, downloadFile } from './utils/pdfEngine';
import { DocumentLibrary } from './components/DocumentLibrary';
import { EditorToolbar } from './components/EditorToolbar';
import { PdfCanvasEditor } from './components/PdfCanvasEditor';
import { DocumentSidebar } from './components/DocumentSidebar';
import { ThumbnailDrawer } from './components/ThumbnailDrawer';
import { CropModal } from './components/CropModal';

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
  const [activeTool, setActiveTool] = useState<AnnotationType | 'select' | 'pan'>('select');
  const [readingTheme, setReadingTheme] = useState<'light' | 'dark' | 'sepia'>('light');

  // UI Panels
  const [isDocumentPanelOpen, setIsDocumentPanelOpen] = useState<boolean>(true);
  const [isThumbnailDrawerOpen, setIsThumbnailDrawerOpen] = useState<boolean>(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Undo/Redo history stack
  const [history, setHistory] = useState<Record<number, PageMetadata>[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Status Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Initial Load: Retrieve stored documents or generate Sample RPG Book
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_DOCS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDocuments(parsed);
          return;
        }
      } catch (e) {
        console.warn('Could not parse saved documents:', e);
      }
    }

    // If no documents exist, create the sample RPG rulebook automatically!
    handleCreateSampleRpg(true);
  }, []);

  // Sync documents list to localStorage (excluding huge binary URIs to avoid quota exhaustion)
  const syncDocumentsToStorage = (updatedDocs: PdfDocumentRecord[]) => {
    setDocuments(updatedDocs);
    try {
      const lightweightDocs = updatedDocs.map((doc) => ({
        ...doc,
        pdfDataUri: undefined, // keep binary in memory
      }));
      localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(lightweightDocs));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
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

      const updated = [newDoc, ...documents.filter((d) => d.id !== newDocId)];
      syncDocumentsToStorage(updated);
      setActiveDocId(newDocId);

      if (!isInitial) {
        showToast('Livro de RPG gerado com sucesso! Teste o índice de capítulos e a remoção da aranha.');
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
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const newDocId = `doc-upload-${Date.now()}`;
    pdfBytesCache.current[newDocId] = bytes;

    const blob = new Blob([bytes], { type: 'application/pdf' });
    const dataUri = URL.createObjectURL(blob);

    try {
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
        tableOfContents: [],
        pageMetadata: {},
      };

      const updated = [newDoc, ...documents];
      syncDocumentsToStorage(updated);
      setActiveDocId(newDocId);
      showToast(`PDF "${file.name}" carregado com sucesso!`);
    } catch (e: any) {
      alert('Não foi possível ler o arquivo PDF: ' + e.message);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = documents.map((d) => (d.id === docId ? { ...d, isFavorite: !d.isFavorite } : d));
    syncDocumentsToStorage(updated);
  };

  // Delete Document
  const handleDeleteDocument = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este PDF da lista?')) {
      const updated = documents.filter((d) => d.id !== docId);
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
    const bytes = pdfBytesCache.current[activeDocId];

    if (!bytes) {
      // Re-create sample if cache was cleared
      handleCreateSampleRpg();
      return;
    }

    loadPdfJsDocument(bytes)
      .then(async (proxy) => {
        if (!isMounted) return;
        setPdfProxy(proxy);
        setCurrentPage(1);


      })
      .catch((err) => {
        console.error('Failed to parse PDF bytes:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeDocId]);

  // Current page metadata & annotations
  const currentPageMeta = activeDoc?.pageMetadata[currentPage] || {
    pageNumber: currentPage,
    rotation: 0,
    annotations: [],
  };

  // Update page metadata with history tracking
  const updatePageMetadata = (
    updater: (prev: Record<number, PageMetadata>) => Record<number, PageMetadata>
  ) => {
    if (!activeDoc) return;
    const currentMetaMap = activeDoc.pageMetadata || {};
    const nextMetaMap = updater(currentMetaMap);

    // Save to history for undo/redo
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(nextMetaMap);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    const updated = documents.map((d) =>
      d.id === activeDoc.id
        ? {
            ...d,
            pageMetadata: nextMetaMap,
            lastOpenedAt: Date.now(),
          }
        : d
    );
    syncDocumentsToStorage(updated);
  };

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0 && activeDoc) {
      const prevMeta = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      const updated = documents.map((d) =>
        d.id === activeDoc.id ? { ...d, pageMetadata: prevMeta } : d
      );
      syncDocumentsToStorage(updated);
      showToast('Ação desfeita');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1 && activeDoc) {
      const nextMeta = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      const updated = documents.map((d) =>
        d.id === activeDoc.id ? { ...d, pageMetadata: nextMeta } : d
      );
      syncDocumentsToStorage(updated);
      showToast('Ação refeita');
    }
  };

  // Add Annotation to current page
  const handleAddAnnotation = (ann: Omit<PageAnnotation, 'id' | 'createdAt'>) => {
    const newId = `ann-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const fullAnnotation: PageAnnotation = {
      ...ann,
      id: newId,
      createdAt: Date.now(),
    };

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
          annotations: [...currentMeta.annotations, fullAnnotation],
        },
      };
    });

    if (ann.type === 'whiteout') {
      showToast('Elemento ocultado com sucesso (diagramação preservada)');
    } else if (ann.type === 'image') {
      showToast('Imagem inserida perfeitamente');
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

  // QUICK ACTION: REMOVE SPIDER (As requested explicitly by user!)
  const handleQuickRemoveSpider = () => {
    if (!activeDoc) return;
    setCurrentPage(5); // Spider is on page 5
    // Coordinates covering the spider illustration cleanly with white background
    handleAddAnnotation({
      pageNumber: 5,
      type: 'whiteout',
      x: 18,
      y: 31,
      width: 64,
      height: 35,
      bgColor: '#ffffff',
    });
    showToast('Aranha removida com sucesso! O texto e a diagramação permanecem intactos.');
  };

  // QUICK ACTION: REPLACE SPIDER WITH WOLF CREST
  const handleQuickReplaceWithWolfCrest = () => {
    if (!activeDoc) return;
    setCurrentPage(5);
    // First, mask the spider
    handleAddAnnotation({
      pageNumber: 5,
      type: 'whiteout',
      x: 18,
      y: 31,
      width: 64,
      height: 35,
      bgColor: '#ffffff',
    });
    // Second, place the Wolf Crest in the exact box
    handleAddAnnotation({
      pageNumber: 5,
      type: 'image',
      x: 18,
      y: 31,
      width: 64,
      height: 35,
      imageUrl: generateWolfCrestPng(),
      imageLabel: 'Brasão do Lobo dos Montes Nevados',
      opacity: 1.0,
    });
    showToast('Arte da aranha substituída pelo Brasão do Lobo!');
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
      showToast('PDF baixado com todas as edições preservadas!');
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

  // VIEW 1: DOCUMENT LIBRARY
  if (!activeDocId || !activeDoc) {
    return (
      <DocumentLibrary
        documents={documents}
        onSelectDocument={(id) => setActiveDocId(id)}
        onToggleFavorite={handleToggleFavorite}
        onDeleteDocument={handleDeleteDocument}
        onCreateSampleRpg={() => handleCreateSampleRpg(false)}
        onFileUpload={handleFileUpload}
        isLoadingSample={isLoadingSample}
      />
    );
  }

  // VIEW 2: PDF VIEWER & EDITOR WORKSPACE
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Toolbar */}
      <EditorToolbar
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
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onExportPdf={handleExportPdf}
        isExporting={isExporting}
        onBackToLibrary={() => setActiveDocId(null)}
      />

      {/* Main Workspace: Left Drawer (Thumbnails) + Center (PDF Canvas) + Right Drawer (Document Sidebar) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Drawer: Page Thumbnails */}
        <ThumbnailDrawer
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
          onQuickRemoveSpider={handleQuickRemoveSpider}
          onQuickReplaceWithWolfCrest={handleQuickReplaceWithWolfCrest}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-indigo-500/50 text-white text-xs font-semibold shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
