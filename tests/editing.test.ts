import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, recordEdit, undoEdit, redoEdit } from '../src/utils/editHistory';
import { transformRect } from '../src/utils/pageGeometry';
import { wrapText } from '../src/utils/textLayout';
import { documentDefinition, exportDocument } from '../src/utils/documentExport';
import { PDFDocument } from 'pdf-lib';

test('first edit can be undone and new edits discard redo without altering another document', () => {
  const original = createHistory({ text: 'initial' });
  const other = createHistory({ text: 'another document' });
  const edited = recordEdit(original, { text: 'changed' });
  assert.deepEqual(undoEdit(edited).present, original.present);
  assert.deepEqual(redoEdit(undoEdit(edited)).present, edited.present);
  assert.equal(recordEdit(undoEdit(edited), { text: 'different' }).future.length, 0);
  assert.equal(other.present.text, 'another document');
});
test('annotation rectangles roundtrip for all right-angle page rotations', () => {
  const rect = { x: 10, y: 20, width: 30, height: 40 };
  for (const rotation of [0, 90, 180, 270]) {
    const result = transformRect(transformRect(rect, 0, rotation), rotation, 0);
    for (const key of ['x', 'y', 'width', 'height'] as const) assert.ok(Math.abs(result[key] - rect[key]) < .00001);
  }
});
test('wrapping preserves explicit paragraphs and splits long words', () => {
  const lines = wrapText('one two\n\nabcdefgh', 4, s => s.length);
  assert.deepEqual(lines, ['one', 'two', '', 'abcd', 'efgh']);
});
test('document export retains formatting and paginates long flowing text', async () => {
  const doc = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Título português' }] },
    ...Array.from({ length: 100 }, (_, i) => ({ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: `Parágrafo ${i}: edição com acentos, coração e organização.`, marks: [{ type: 'bold' }] }] })),
  ] };
  const definition = documentDefinition(doc);
  assert.equal((definition.content as any[])[1].alignment, 'center');
  assert.equal((definition.content as any[])[1].text[0].bold, true);
  const pdf = await PDFDocument.load(await exportDocument(doc));
  assert.ok(pdf.getPageCount() >= 3, 'overflow must create pages rather than truncate text');
});
