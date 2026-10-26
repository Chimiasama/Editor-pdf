export interface Rect { x: number; y: number; width: number; height: number }
export function normalizeRotation(rotation: number) { return ((rotation % 360) + 360) % 360; }
// Normalized viewport coordinates (top-left origin) ↔ normalized PDF coordinates (bottom-left).
export function toPdfPoint(x: number, y: number, rotation: number): [number, number] {
  switch (normalizeRotation(rotation)) {
    case 90: return [y, x];
    case 180: return [1 - x, y];
    case 270: return [1 - y, 1 - x];
    default: return [x, 1 - y];
  }
}
export function fromPdfPoint(x: number, y: number, rotation: number): [number, number] {
  switch (normalizeRotation(rotation)) {
    case 90: return [y, x];
    case 180: return [1 - x, y];
    case 270: return [1 - y, 1 - x];
    default: return [x, 1 - y];
  }
}
export function transformRect(rect: Rect, from: number, to: number): Rect {
  const points = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height]]
    .map(([x, y]) => { const pdf = toPdfPoint(x / 100, y / 100, from); return fromPdfPoint(...pdf, to).map(v => v * 100); });
  const x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
  return { x, y, width: Math.max(...points.map(p => p[0])) - x, height: Math.max(...points.map(p => p[1])) - y };
}
