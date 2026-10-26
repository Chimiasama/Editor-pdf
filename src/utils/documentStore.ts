import type { PdfDocumentRecord } from '../types/pdf';

const DB_NAME = 'editpdf-library';
let connection: Promise<IDBDatabase> | undefined;
function openDB() {
  return connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents', { keyPath: 'id' });
      request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => reject(new Error('Feche outras abas para atualizar a biblioteca.'));
  });
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível salvar no aparelho.'));
    tx.onabort = () => reject(tx.error ?? new Error('Gravação interrompida.'));
    run(tx, result => { value = result; });
  });
}
export function listDocuments() {
  return transaction<PdfDocumentRecord[]>(['documents'], 'readonly', (tx, result) => {
    const request = tx.objectStore('documents').getAll();
    request.onsuccess = () => result(request.result.sort((a, b) => b.createdAt - a.createdAt));
  });
}
export function saveDocument(doc: PdfDocumentRecord, bytes?: Uint8Array) {
  return transaction<void>(['documents', 'files'], 'readwrite', tx => {
    tx.objectStore('documents').put({ ...doc, pdfDataUri: undefined });
    if (bytes) tx.objectStore('files').put(bytes.slice(), doc.id);
  });
}
export function readDocumentBytes(id: string) {
  return transaction<Uint8Array | undefined>(['files'], 'readonly', (tx, result) => {
    const request = tx.objectStore('files').get(id);
    request.onsuccess = () => result(request.result);
  });
}
export function deleteStoredDocument(id: string) {
  return transaction<void>(['documents', 'files'], 'readwrite', tx => {
    tx.objectStore('documents').delete(id);
    tx.objectStore('files').delete(id);
  });
}
