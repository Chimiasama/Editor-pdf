import { Util, type PDFDocumentProxy } from 'pdfjs-dist';
import type { TocItem } from '../types/pdf';
export interface TextBlock { id: string; text: string; x: number; y: number; width: number; height: number; fontSize: number }
export async function pageTextBlocks(pdf: PDFDocumentProxy, pageNumber: number): Promise<TextBlock[]> {
  const page = await pdf.getPage(pageNumber);
  // Keep text correction restricted to upright pages; rotated/skewed text needs a richer engine.
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  const content = await page.getTextContent();
  const blocks: TextBlock[] = [];
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const t = Util.transform(viewport.transform, item.transform);
    if (Math.abs(t[1]) > .1 || Math.abs(t[2]) > .1) continue;
    const height = Math.hypot(t[2], t[3]);
    blocks.push({ id: `${pageNumber}-${blocks.length}`, text: item.str, x: 100 * t[4] / viewport.width,
      y: 100 * (t[5] - height) / viewport.height, width: Math.max(1, 100 * item.width / viewport.width),
      height: Math.max(1, 100 * height * 1.2 / viewport.height), fontSize: height });
  }
  return blocks;
}
export async function readOutline(pdf: PDFDocumentProxy): Promise<TocItem[]> {
  const outline = await pdf.getOutline();
  const items: TocItem[] = [];
  async function visit(nodes: NonNullable<typeof outline>) {
    for (const node of nodes) {
      try {
        const dest = typeof node.dest === 'string' ? await pdf.getDestination(node.dest) : node.dest;
        if (dest?.length) {
          const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
          if (index >= 0 && index < pdf.numPages) items.push({ id: `outline-${items.length}`, title: node.title, pageNumber: index + 1 });
        }
      } catch { /* A malformed bookmark must not prevent opening the document. */ }
      if (node.items?.length) await visit(node.items);
    }
  }
  if (outline) await visit(outline);
  return items;
}
