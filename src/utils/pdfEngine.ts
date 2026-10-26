import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  // Bundle the worker with the exact installed PDF.js version.
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
}

/**
 * Load PDF with pdfjs-dist from Uint8Array or ArrayBuffer
 */
export async function loadPdfJsDocument(pdfData: Uint8Array | ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument({
    // PDF.js transfers buffers to its worker; retain the saved original.
    data: pdfData instanceof Uint8Array ? pdfData.slice() : pdfData.slice(0),
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
  });
  return await loadingTask.promise;
}

/**
 * Render a page to an HTML5 canvas with crisp DPI
 */
export async function renderPdfPage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0,
  rotationOffset: number = 0
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const currentRotation = (page.rotate + rotationOffset) % 360;
  const viewport = page.getViewport({ scale: scale, rotation: currentRotation });

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { width: viewport.width, height: viewport.height };

  ctx.save();
  ctx.scale(pixelRatio, pixelRatio);

  const renderContext = {
    canvasContext: ctx,
    canvas,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  ctx.restore();

  return { width: viewport.width, height: viewport.height };
}

/**
 * Extract all text from PDF pages for AI analysis (TOC, spellcheck, QA)
 */
export async function extractPdfText(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  maxPages: number = 20
): Promise<ExtractedPageText[]> {
  const results: ExtractedPageText[] = [];
  const total = Math.min(pdfDoc.numPages, maxPages);

  for (let i = 1; i <= total; i++) {
    try {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      results.push({ pageNumber: i, text: pageText });
    } catch (e) {
      console.warn(`Failed to extract text from page ${i}`, e);
    }
  }

  return results;
}

export { exportEditedPdf } from './pdfExport';

/**
 * Trigger file download directly in browser
 */
export async function downloadFile(bytes: Uint8Array, fileName: string) {
  if (Capacitor.isNativePlatform()) {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { uri } = await Filesystem.writeFile({
      path: safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: 'Salvar PDF editado', files: [uri] });
    return;
  }
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
