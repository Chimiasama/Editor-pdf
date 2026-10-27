export interface TocItem {
  id: string;
  title: string;
  pageNumber: number;
  category?: string;
  description?: string;
}

export type EditorTool = AnnotationType | 'select' | 'pan' | 'edit-text';

export type AnnotationType = 'text' | 'image' | 'whiteout' | 'shape' | 'highlight' | 'draw';

export interface PageAnnotation {
  id: string;
  pageNumber: number;
  type: AnnotationType;
  x: number; // percentage (0 to 100) or points
  y: number;
  width: number;
  height: number;
  viewRotation?: number;
  sourceTextId?: string;
  sourceRegion?: { x: number; y: number; width: number; height: number };
  // Text specifics
  text?: string;
  fontSize?: number;
  color?: string;
  bgColor?: string;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  // Image specifics
  imageUrl?: string;
  imageLabel?: string;
  opacity?: number;
  // Shape specifics
  shapeType?: 'rectangle' | 'circle' | 'line' | 'arrow';
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  // Freehand specifics
  pathPoints?: { x: number; y: number }[];
  createdAt: number;
}

export interface PageMetadata {
  pageNumber: number;
  rotation: number; // 0, 90, 180, 270
  cropBox?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  annotations: PageAnnotation[];
}

export interface PdfDocumentRecord {
  id: string;
  title: string;
  fileSizeFormatted: string;
  pageCount: number;
  isFavorite: boolean;
  category?: string;
  lastOpenedAt: number;
  lastPage?: number;
  createdAt: number;
  hasWorkingCopy?: boolean;
  archivedPageMetadata?: Record<number, PageMetadata>;
  documentContent?: import('@tiptap/react').JSONContent;
  pdfDataUri?: string; // base64 or object url
  tableOfContents: TocItem[];
  pageMetadata: Record<number, PageMetadata>;
}
