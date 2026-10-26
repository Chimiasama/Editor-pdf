import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listDocuments, readDocumentBytes, saveDocument, deleteStoredDocument } from '../src/utils/documentStore';
import type { PdfDocumentRecord } from '../src/types/pdf';
const doc: PdfDocumentRecord = { id: 'persist-test', title: 'My PDF', pageCount: 1, fileSizeFormatted: '1 KB', isFavorite: false, createdAt: 1, lastOpenedAt: 1, tableOfContents: [], pageMetadata: {} };
test('binary PDF, metadata and document draft survive independent reads; deleting removes both stores', async () => {
  const bytes = new Uint8Array([37, 80, 68, 70]);
  await saveDocument(doc, bytes);
  bytes[0] = 0;
  assert.deepEqual(await readDocumentBytes(doc.id), new Uint8Array([37, 80, 68, 70]));
  await saveDocument({ ...doc, isFavorite: true, documentContent: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Persistent edit' }] }] } });
  const reopened = (await listDocuments()).find(d => d.id === doc.id)!;
  assert.equal(reopened.isFavorite, true);
  assert.equal(reopened.documentContent?.content?.[0].content?.[0].text, 'Persistent edit');
  assert.deepEqual(await readDocumentBytes(doc.id), new Uint8Array([37, 80, 68, 70]));
  await deleteStoredDocument(doc.id);
  assert.equal(await readDocumentBytes(doc.id), undefined);
  assert.equal((await listDocuments()).some(d => d.id === doc.id), false);
});

test('working copies survive reads and never overwrite the imported original', async () => {
  const { saveWorkingCopy, readWorkingCopy } = await import('../src/utils/documentStore');
  const original = new Uint8Array([37,80,68,70,1]);
  await saveDocument(doc, original);
  const edited = new Uint8Array([37,80,68,70,2]);
  await saveWorkingCopy({ ...doc, hasWorkingCopy:true }, edited);
  edited[4]=99;
  assert.deepEqual(await readDocumentBytes(doc.id), original);
  assert.deepEqual(await readWorkingCopy(doc.id), new Uint8Array([37,80,68,70,2]));
  await deleteStoredDocument(doc.id);
  assert.equal(await readWorkingCopy(doc.id),undefined);
});
