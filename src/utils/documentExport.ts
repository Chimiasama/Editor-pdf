import type { JSONContent } from '@tiptap/react';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

export function documentDefinition(doc: JSONContent): TDocumentDefinitions {
  function inline(nodes: JSONContent[] = []): any[] {
    return nodes.map(node => {
      if (node.type === 'hardBreak') return { text: '\n' };
      const style = node.marks?.find(mark => mark.type === 'textStyle')?.attrs;
      return { text: node.text || '', bold: !!node.marks?.some(m => m.type === 'bold'),
        italics: !!node.marks?.some(m => m.type === 'italic'),
        decoration: node.marks?.some(m => m.type === 'underline') ? 'underline' : node.marks?.some(m => m.type === 'strike') ? 'lineThrough' : undefined,
        color: /^#[0-9a-f]{6}$/i.test(style?.color || '') ? style!.color : undefined,
        fontSize: style?.fontSize ? Math.min(72, Math.max(8, parseFloat(style.fontSize) * .75)) : undefined };
    });
  }
  function block(node: JSONContent): any {
    const align = node.attrs?.textAlign;
    if (node.type === 'image') {
      if (!/^data:image\/(png|jpeg);base64,/.test(node.attrs?.src || '')) throw new Error('Imagem não suportada. Use PNG ou JPEG.');
      return { image: node.attrs!.src, fit: [Math.min(490, Math.max(30, Number(node.attrs?.width || 653) * .75)), 650], margin: [0, 4, 0, 8] };
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') return { [node.type === 'bulletList' ? 'ul' : 'ol']: (node.content || []).map(item => ({ stack: (item.content || []).map(block) })), margin: [0, 0, 0, 8], start: node.attrs?.start || 1 };
    if (node.type === 'blockquote') return { stack: (node.content || []).map(block), margin: [18, 0, 0, 8], color: '#475569' };
    if (node.type === 'horizontalRule') return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 490, y2: 0, lineWidth: 1 }], margin: [0, 8, 0, 8] };
    return { text: inline(node.content).length ? inline(node.content) : ' ', alignment: ['left', 'center', 'right', 'justify'].includes(align) ? align : 'left',
      fontSize: node.type === 'heading' ? [24, 20, 16][Math.min(2, (node.attrs?.level || 1) - 1)] : 12,
      bold: node.type === 'heading', margin: [0, 0, 0, 8], preserveLeadingSpaces: true };
  }
  return { info: { title: 'Documento editado' }, pageSize: 'A4', pageMargins: [50, 50, 50, 50],
    defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.25 }, content: (doc.content || []).map(block) as Content[] };
}
export async function exportDocument(doc: JSONContent): Promise<Uint8Array> {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  pdfMake.addVirtualFileSystem(fonts);
  return new Uint8Array(await pdfMake.createPdf(documentDefinition(doc)).getBuffer());
}
