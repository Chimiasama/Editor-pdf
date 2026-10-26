import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';
import { exportEditedPdf } from '../src/utils/pdfExport';

async function fixture() {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]).drawText('Original document');
  pdf.addPage([600, 800]);
  return pdf.save();
}

test('export preserves page count, dimensions and input bytes without edits', async () => {
  const bytes = await fixture();
  const original = bytes.slice();
  const exported = await PDFDocument.load(await exportEditedPdf(bytes, {}));
  assert.equal(exported.getPageCount(), 2);
  assert.deepEqual(exported.getPage(0).getSize(), { width: 600, height: 800 });
  assert.deepEqual(bytes, original);
});

test('rotation and crop affect only the selected page', async () => {
  const exported = await PDFDocument.load(await exportEditedPdf(await fixture(), {
    1: { pageNumber: 1, rotation: 90, annotations: [], cropBox: { top: 10, bottom: 20, left: 5, right: 15 } },
  }));
  assert.equal(exported.getPage(0).getRotation().angle, 90);
  assert.deepEqual(exported.getPage(0).getCropBox(), { x: 30, y: 160, width: 480, height: 560 });
  assert.equal(exported.getPage(1).getRotation().angle, 0);
  assert.deepEqual(exported.getPage(1).getCropBox(), { x: 0, y: 0, width: 600, height: 800 });
});

test('text and whiteout append content streams while retaining original content', async () => {
  const bytes = await fixture();
  const original = await PDFDocument.load(bytes);
  const before = original.getPage(0).node.lookup(PDFName.of('Contents'), PDFArray).size();
  const exported = await PDFDocument.load(await exportEditedPdf(bytes, {
    1: { pageNumber: 1, rotation: 0, annotations: [
      { id: 'mask', pageNumber: 1, type: 'whiteout', x: 10, y: 10, width: 30, height: 10, createdAt: 0 },
      { id: 'text', pageNumber: 1, type: 'text', x: 10, y: 20, width: 50, height: 10, text: 'Edited text', createdAt: 0 },
    ] },
  }));
  assert.ok(exported.getPage(0).node.lookup(PDFName.of('Contents'), PDFArray).size() > before);
  assert.equal(exported.getPageCount(), 2);
});

test('export rejects overflowing text rather than silently dropping lines', async () => {
  await assert.rejects(exportEditedPdf(await fixture(), {
    1: { pageNumber: 1, rotation: 0, annotations: [
      { id: 'overflow', pageNumber: 1, type: 'text', x: 10, y: 10, width: 10, height: 2, text: 'A long paragraph that cannot fit in a tiny box', fontSize: 18, createdAt: 0 },
    ] },
  }), /não cabe/);
});
