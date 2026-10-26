import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { PageMetadata } from '../types/pdf';

/**
 * Helper to convert hex color (#ffffff or #4f46e5) to pdf-lib rgb(r, g, b)
 */
function hexToRgb(hex?: string) {
  if (!hex || !hex.startsWith('#')) return rgb(0.1, 0.1, 0.1);
  const cleanHex = hex.replace('#', '');
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  }
  return rgb(r, g, b);
}

/**
 * Export and burn in all edits (Text modifications, Whiteouts/Element removals,
 * Image insertions/replacements, Shapes, Rotations) into a real PDF using pdf-lib!
 */
export async function exportEditedPdf(
  originalPdfBytes: Uint8Array,
  pageMetadataMap: Record<number, PageMetadata>,
  documentTitle: string = 'documento_editado.pdf'
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const page = pages[i];
    const meta = pageMetadataMap[pageNum];
    const { width, height } = page.getSize();

    if (!meta) continue;

    // 1. Rotation adjustments
    if (meta.rotation && meta.rotation !== 0) {
      const currentRot = page.getRotation().angle;
      page.setRotation(degrees((currentRot + meta.rotation) % 360));
    }

    // 2. Crop adjustments if defined
    if (meta.cropBox) {
      const crop = meta.cropBox;
      const cropX = (crop.left / 100) * width;
      const cropY = (crop.bottom / 100) * height;
      const cropW = width - cropX - (crop.right / 100) * width;
      const cropH = height - cropY - (crop.top / 100) * height;
      if (cropW > 50 && cropH > 50) {
        page.setCropBox(cropX, cropY, cropW, cropH);
      }
    }

    // 3. Annotations & Edits
    if (meta.annotations && meta.annotations.length > 0) {
      for (const ann of meta.annotations) {
        // Convert percentages (0 to 100) to PDF coordinates
        // Note: In PDF coordinate system, (0, 0) is BOTTOM-LEFT.
        // In web overlay, (0, 0) is TOP-LEFT.
        const annWidth = (ann.width / 100) * width;
        const annHeight = (ann.height / 100) * height;
        const annX = (ann.x / 100) * width;
        const annY = height - (ann.y / 100) * height - annHeight;

        if (ann.type === 'whiteout') {
          // REMOVE IMAGE / ELEMENT:
          // Draws a clean solid background box matching color (defaults to pure white)
          // Preserving diagramation and eliminating unwanted graphics like the spider!
          const fillColor = hexToRgb(ann.bgColor || '#ffffff');
          page.drawRectangle({
            x: annX,
            y: annY,
            width: annWidth,
            height: annHeight,
            color: fillColor,
          });
        } else if (ann.type === 'image' && ann.imageUrl) {
          try {
            // Embed image (png or jpg)
            const isPng = ann.imageUrl.includes('image/png');
            const base64Data = ann.imageUrl.split(',')[1] || ann.imageUrl;
            const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

            const embeddedImg = isPng
              ? await pdfDoc.embedPng(imgBytes)
              : await pdfDoc.embedJpg(imgBytes);

            page.drawImage(embeddedImg, {
              x: annX,
              y: annY,
              width: annWidth,
              height: annHeight,
              opacity: ann.opacity !== undefined ? ann.opacity : 1.0,
            });
          } catch (imgErr) {
            console.warn('Could not embed annotation image:', imgErr);
          }
        } else if (ann.type === 'text' && ann.text) {
          // Add or edit text box
          if (ann.bgColor) {
            page.drawRectangle({
              x: annX,
              y: annY,
              width: annWidth,
              height: annHeight,
              color: hexToRgb(ann.bgColor),
            });
          }

          const font =
            ann.fontWeight === 'bold'
              ? fontBold
              : ann.fontStyle === 'italic'
              ? fontItalic
              : fontRegular;

          const fontSize = ann.fontSize || 12;
          const textColor = hexToRgb(ann.color || '#0f172a');

          // Split text into lines to avoid overflow
          const lines = ann.text.split('\n');
          let textLineY = annY + annHeight - fontSize - 2;

          for (const line of lines) {
            if (textLineY >= annY) {
              page.drawText(line, {
                x: annX + 4,
                y: textLineY,
                size: fontSize,
                font: font,
                color: textColor,
              });
              textLineY -= fontSize * 1.25;
            }
          }
        } else if (ann.type === 'highlight') {
          // Transparent highlight box
          page.drawRectangle({
            x: annX,
            y: annY,
            width: annWidth,
            height: annHeight,
            color: hexToRgb(ann.bgColor || '#fef08a'),
            opacity: 0.45,
          });
        } else if (ann.type === 'shape') {
          const stroke = hexToRgb(ann.strokeColor || '#4f46e5');
          const fill = ann.fillColor ? hexToRgb(ann.fillColor) : undefined;
          const strokeWidth = ann.strokeWidth || 2;

          if (ann.shapeType === 'circle') {
            const rx = annWidth / 2;
            const ry = annHeight / 2;
            page.drawEllipse({
              x: annX + rx,
              y: annY + ry,
              xScale: rx,
              yScale: ry,
              borderColor: stroke,
              borderWidth: strokeWidth,
              color: fill,
            });
          } else {
            // Default rectangle
            page.drawRectangle({
              x: annX,
              y: annY,
              width: annWidth,
              height: annHeight,
              borderColor: stroke,
              borderWidth: strokeWidth,
              color: fill,
            });
          }
        }
      }
    }
  }

  const finalBytes = await pdfDoc.save();
  return finalBytes;
}

