import { PDFDocument, rgb, degrees, StandardFonts, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib';
import type { PageMetadata } from '../types/pdf';
import { normalizeRotation } from './pageGeometry';
import { wrapText } from './textLayout';
function color(hex = '#172033') {
  const s = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(s)) throw new Error('Cor inválida. Escolha uma cor no editor.');
  return rgb(parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255);
}
export async function exportEditedPdf(originalPdfBytes: Uint8Array, metadata: Record<number, PageMetadata>, documentTitle = 'documento.pdf'): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(originalPdfBytes);
  pdf.setTitle(documentTitle);
  let regular, bold, italic, boldItalic;
  if (Object.values(metadata).some(m => m.annotations.some(a => a.type === 'text'))) {
    const [{ default: fontkit }, { default: fonts }] = await Promise.all([import('@pdf-lib/fontkit'), import('pdfmake/build/vfs_fonts')]);
    pdf.registerFontkit(fontkit);
    [regular, bold, italic, boldItalic] = await Promise.all(['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Italic.ttf', 'Roboto-MediumItalic.ttf'].map(name => pdf.embedFont(Uint8Array.from(atob(fonts[name]), c => c.charCodeAt(0)), { subset: true })));
  } else {
    regular = await pdf.embedFont(StandardFonts.Helvetica); bold = italic = boldItalic = regular;
  }
  for (const [index, page] of pdf.getPages().entries()) {
    const meta = metadata[index + 1];
    if (!meta) continue;
    const crop = page.getCropBox();
    const W = crop.width, H = crop.height;
    const finalRotation = normalizeRotation(page.getRotation().angle + (meta.rotation || 0));
    page.setRotation(degrees(finalRotation));
    if (meta.cropBox) {
      const c = meta.cropBox;
      const width = W * (1 - (c.left + c.right) / 100), height = H * (1 - (c.top + c.bottom) / 100);
      if (width <= 50 || height <= 50) throw new Error('O recorte deixa a página pequena demais. Ajuste as margens.');
      page.setCropBox(crop.x + W * c.left / 100, crop.y + H * c.bottom / 100, width, height);
    }
    for (const ann of meta.annotations) {
      const rotation = normalizeRotation(ann.viewRotation ?? 0);
      const width = rotation % 180 ? H : W, height = rotation % 180 ? W : H;
      const matrices: Record<number, [number, number, number, number, number, number]> = {
        0: [1, 0, 0, 1, crop.x, crop.y], 90: [0, 1, -1, 0, crop.x + W, crop.y],
        180: [-1, 0, 0, -1, crop.x + W, crop.y + H], 270: [0, -1, 1, 0, crop.x, crop.y + H],
      };
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...matrices[rotation]));
      const x = ann.x * width / 100, y = height * (1 - (ann.y + ann.height) / 100);
      const w = ann.width * width / 100, h = ann.height * height / 100;
      if (ann.sourceRegion) {
        const r = ann.sourceRegion;
        page.drawRectangle({ x: r.x * width / 100, y: height * (1 - (r.y + r.height) / 100), width: r.width * width / 100, height: r.height * height / 100, color: color('#ffffff') });
      }
      if (ann.type === 'whiteout') page.drawRectangle({ x, y, width: w, height: h, color: color(ann.bgColor || '#ffffff') });
      else if (ann.type === 'highlight') page.drawRectangle({ x, y, width: w, height: h, color: color(ann.bgColor || '#fde047'), opacity: .45 });
      else if (ann.type === 'shape') {
        const options = { borderColor: color(ann.strokeColor || '#4f46e5'), borderWidth: ann.strokeWidth || 2, color: ann.fillColor ? color(ann.fillColor) : undefined };
        if (ann.shapeType === 'circle') page.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, ...options });
        else page.drawRectangle({ x, y, width: w, height: h, ...options });
      } else if (ann.type === 'image' && ann.imageUrl) {
        const bytes = Uint8Array.from(atob(ann.imageUrl.split(',')[1]), c => c.charCodeAt(0));
        const image = ann.imageUrl.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        page.drawImage(image, { x, y, width: w, height: h, opacity: ann.opacity ?? 1 });
      } else if (ann.type === 'text') {
        const font = ann.fontWeight === 'bold' ? ann.fontStyle === 'italic' ? boldItalic : bold : ann.fontStyle === 'italic' ? italic : regular;
        const size = ann.fontSize || 12;
        const lines = wrapText(ann.text || '', Math.max(1, w - 8), value => font.widthOfTextAtSize(value, size));
        if (lines.length * size * 1.25 + 8 > h + .1) throw new Error(`O texto da página ${index + 1} não cabe na caixa. Aumente a altura ou reduza a fonte antes de exportar.`);
        if (ann.bgColor) page.drawRectangle({ x, y, width: w, height: h, color: color(ann.bgColor) });
        let baseline = y + h - size - 4;
        for (const line of lines) {
          const textWidth = font.widthOfTextAtSize(line, size);
          const lineX = ann.textAlign === 'center' ? x + (w - textWidth) / 2 : ann.textAlign === 'right' ? x + w - textWidth - 4 : x + 4;
          page.drawText(line, { x: lineX, y: baseline, size, font, color: color(ann.color), lineHeight: size * 1.25 });
          baseline -= size * 1.25;
        }
      }
      page.pushOperators(popGraphicsState());
    }
  }
  return pdf.save();
}
