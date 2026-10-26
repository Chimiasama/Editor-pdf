export interface EditHistory<T> { past: T[]; present: T; future: T[] }
export function createHistory<T>(present: T): EditHistory<T> { return { past: [], present, future: [] }; }
export function recordEdit<T>(history: EditHistory<T>, present: T): EditHistory<T> {
  return { past: [...history.past.slice(-49), history.present], present, future: [] };
}
export function undoEdit<T>(h: EditHistory<T>): EditHistory<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] };
}
export function redoEdit<T>(h: EditHistory<T>): EditHistory<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
