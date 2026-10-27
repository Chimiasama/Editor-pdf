import type { PdfDocumentRecord } from "../types/pdf";

const DB_NAME = "editpdf-library";
let connection: Promise<IDBDatabase> | undefined;
function openDB() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("documents"))
        db.createObjectStore("documents", { keyPath: "id" });
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      if (!db.objectStoreNames.contains("working"))
        db.createObjectStore("working");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () =>
      reject(new Error("Feche outras abas para atualizar a biblioteca."));
  }));
}
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction, result: (value: T) => void) => void,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onerror = () =>
      reject(tx.error ?? new Error("Não foi possível salvar no aparelho."));
    tx.onabort = () => reject(tx.error ?? new Error("Gravação interrompida."));
    try {
      run(tx, (result) => {
        value = result;
      });
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
export function listDocuments() {
  return transaction<PdfDocumentRecord[]>(
    ["documents"],
    "readonly",
    (tx, result) => {
      const request = tx.objectStore("documents").getAll();
      request.onsuccess = () =>
        result(request.result.sort((a, b) => b.createdAt - a.createdAt));
    },
  );
}
export function saveDocument(doc: PdfDocumentRecord, bytes?: Uint8Array) {
  return transaction<void>(["documents", "files"], "readwrite", (tx) => {
    tx.objectStore("documents").put({ ...doc, pdfDataUri: undefined });
    if (bytes) tx.objectStore("files").put(bytes.slice(), doc.id);
  });
}
export function readDocumentBytes(id: string) {
  return transaction<Uint8Array | undefined>(
    ["files"],
    "readonly",
    (tx, result) => {
      const request = tx.objectStore("files").get(id);
      request.onsuccess = () => result(request.result);
    },
  );
}
export function deleteStoredDocument(id: string) {
  return transaction<void>(
    ["documents", "files", "working"],
    "readwrite",
    (tx) => {
      tx.objectStore("working").delete(id);
      tx.objectStore("documents").delete(id);
      tx.objectStore("files").delete(id);
    },
  );
}

/** Original imported bytes remain in files. Only the editable copy is overwritten. */
export function saveWorkingCopy(doc: PdfDocumentRecord, bytes: Uint8Array) {
  return transaction<void>(["documents", "working"], "readwrite", (tx) => {
    tx.objectStore("documents").put({ ...doc, pdfDataUri: undefined });
    tx.objectStore("working").put(bytes.slice(), doc.id);
  });
}
export function readWorkingCopy(id: string) {
  return transaction<Uint8Array | undefined>(
    ["working"],
    "readonly",
    (tx, result) => {
      const request = tx.objectStore("working").get(id);
      request.onsuccess = () => result(request.result);
    },
  );
}
