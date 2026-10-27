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
  blockId: number;
  lineId: number;
}
export interface TextBlock extends TextRun {
  runIds: string[];
  lineCount: number;
  lineHeight: number;
  align?: "left" | "center" | "right";
}
export interface TextBlockHint {
  rect: Rect;
  lineRects: Rect[];
  lineHeight: number;
  align: "left" | "center" | "right";
  separators: string[];
}
export interface TextBoxOptions {
  rect: Rect;
  size: number;
  fit?: boolean;
  align?: "left" | "center" | "right";
  lineSpacing?: number;
}
export interface TextBoxLayout {
  lines: {
    text: string;
    x: number;
    baseline: number;
    width: number;
    rect: Rect;
    separatorBefore: string;
  }[];
  fontSize: number;
  lineHeight: number;
  requiredHeight: number;
  fits: boolean;
  rect: Rect;
  message: string;
  equivalentFont?: boolean;
  preview?: RenderedPage;
}
export type TextBoxEdit = TextBoxOptions & {
  page: number;
  text: string;
  color: string;
} & (
    | { type: "replace-block"; id: string; original: string }
    | { type: "insert-block" }
  );
export interface PageImage {
  id: string;
  rect: Rect;
  width: number;
  height: number;
}
export interface PageContent {
  bounds: Rect;
  texts: TextRun[];
  blocks: TextBlock[];
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
  | TextBoxEdit
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
  layout: {
    args: { edit: TextBoxEdit; preview?: boolean };
    result: TextBoxLayout;
  };
  undo: { args: undefined; result: HistoryState };
  redo: { args: undefined; result: HistoryState };
  save: { args: undefined; result: Uint8Array };
  close: { args: undefined; result: undefined };
}
