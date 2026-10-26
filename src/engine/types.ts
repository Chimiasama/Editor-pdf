export type Rect = [number, number, number, number];
export interface TextRun {
  id: string;
  text: string;
  rect: Rect;
  origin: [number, number];
  fontName: string;
  size: number;
  color: string;
  editable: boolean;
}
export interface PageImage {
  id: string;
  rect: Rect;
  width: number;
  height: number;
}
export interface PageContent {
  bounds: Rect;
  texts: TextRun[];
  images: PageImage[];
}
export interface PdfInfo {
  pageCount: number;
  canEdit: boolean;
  outline: { title: string; page: number }[];
}
export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}
export type PdfEdit =
  | {
      type: "replace-text";
      page: number;
      id: string;
      original: string;
      text: string;
      size: number;
      color: string;
      fit: boolean;
    }
  | {
      type: "insert-text";
      page: number;
      point: [number, number];
      text: string;
      size: number;
      color: string;
    }
  | { type: "delete-image"; page: number; id: string }
  | {
      type: "insert-image";
      page: number;
      rect: Rect;
      bytes: Uint8Array;
      background: boolean;
    }
  | { type: "rotate"; page: number };
export interface EditResult extends HistoryState {
  message: string;
}
export interface RenderedPage {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}
export interface RpcMethods {
  open: { args: { bytes: Uint8Array; password?: string }; result: PdfInfo };
  content: { args: { page: number }; result: PageContent };
  render: { args: { page: number; scale: number }; result: RenderedPage };
  edit: { args: PdfEdit; result: EditResult };
  undo: { args: undefined; result: HistoryState };
  redo: { args: undefined; result: HistoryState };
  save: { args: undefined; result: Uint8Array };
  close: { args: undefined; result: undefined };
}
