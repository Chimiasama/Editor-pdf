import { useEffect, useRef, useState } from "react";
import { foldText } from "../engine/textLayout";
import { LoaderCircle } from "lucide-react";
import type { PdfClient } from "../engine/client";
import type {
  PageContent,
  TextRun,
  TextBlock,
  PageImage,
} from "../engine/types";
export type ReaderTool = "read" | "text" | "images" | "add-text" | "add-image";
interface Props {
  client: PdfClient;
  page: number;
  revision: number;
  zoom: number;
  content: PageContent;
  tool: ReaderTool;
  disabled: boolean;
  search: string;
  selectionMode: "paragraph" | "run";
  onText: (text: TextRun | TextBlock) => void;
  onImage: (image: PageImage) => void;
  onPoint: (point: [number, number]) => void;
  onError: (message: string) => void;
  onZoom: (zoom: number) => void;
}
export function ReaderPage({
  client,
  page,
  revision,
  zoom,
  content,
  tool,
  disabled,
  search,
  onText,
  selectionMode,
  onImage,
  onPoint,
  onError,
  onZoom,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [availableWidth, setAvailableWidth] = useState(800);
  const [rendering, setRendering] = useState(true);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const [x0, y0, x1, y1] = content.bounds;
  const width = x1 - x0,
    height = y1 - y0;
  const cssWidth =
    Math.min(
      850,
      Math.max(200, availableWidth - (availableWidth < 600 ? 24 : 80)),
    ) * zoom;
  const scale = cssWidth / width;
  useEffect(() => {
    const el = container.current!;
    const observer = new ResizeObserver((entries) =>
      setAvailableWidth(entries[0].contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    setRendering(true);
    const timer = setTimeout(
      () =>
        client
          .call("render", {
            page,
            scale: scale * Math.min(window.devicePixelRatio || 1, 2),
          })
          .then((result) => {
            if (cancelled || !canvas.current) return;
            const el = canvas.current;
            el.width = result.width;
            el.height = result.height;
            el.getContext("2d")?.putImageData(
              new ImageData(
                new Uint8ClampedArray(result.pixels),
                result.width,
                result.height,
              ),
              0,
              0,
            );
            setRendering(false);
          })
          .catch((error) => {
            if (!cancelled) {
              setRendering(false);
              onError(error.message);
            }
          }),
      80,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, page, revision, scale]);
  useEffect(() => {
    container.current?.scrollTo({ top: 0, left: 0 });
  }, [page]);
  const position = (rect: number[]) => ({
    left: (rect[0] - x0) * scale,
    top: (rect[1] - y0) * scale,
    width: (rect[2] - rect[0]) * scale,
    height: (rect[3] - rect[1]) * scale,
  });
  const normalize = foldText;
  return (
    <div
      className="reader-scroll"
      ref={container}
      data-testid="reader-scroll"
      onTouchStart={(e) => {
        if (e.touches.length === 2 && tool === "read")
          pinch.current = {
            distance: Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY,
            ),
            zoom,
          };
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 2 && pinch.current && tool === "read") {
          const distance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY,
          );
          onZoom(
            Math.min(
              3,
              Math.max(
                0.5,
                (pinch.current.zoom * distance) / pinch.current.distance,
              ),
            ),
          );
        }
      }}
      onTouchEnd={() => {
        pinch.current = null;
      }}
    >
      <div className="page-stage" style={{ minWidth: cssWidth + 24 }}>
        <div
          className={`pdf-paper tool-${tool}`}
          style={{ width: cssWidth, height: height * scale }}
          aria-label={`Página ${page}`}
          onClick={(e) => {
            if (
              disabled ||
              rendering ||
              !["add-text", "add-image"].includes(tool)
            )
              return;
            const rect = e.currentTarget.getBoundingClientRect();
            onPoint([
              x0 + (e.clientX - rect.left) / scale,
              y0 + (e.clientY - rect.top) / scale,
            ]);
          }}
        >
          <canvas
            ref={canvas}
            style={{ width: cssWidth, height: height * scale }}
            aria-label={`Conteúdo da página ${page}`}
          />
          {!rendering &&
            search &&
            content.texts
              .filter((t) => normalize(t.text).includes(normalize(search)))
              .map((t) => (
                <span
                  className="search-match"
                  key={t.id}
                  style={position(t.rect)}
                />
              ))}
          {!rendering &&
            !disabled &&
            tool === "text" &&
            (selectionMode === "paragraph"
              ? content.blocks
              : content.texts
            ).map((text) => (
              <button
                key={text.id}
                className={`text-target ${text.editable ? "" : "unsupported"}`}
                style={position(text.rect)}
                aria-label={`Editar: ${text.text}`}
                disabled={!text.editable}
                onClick={(e) => {
                  e.stopPropagation();
                  onText(text);
                }}
                data-text-block={"runIds" in text ? text.id : undefined}
                title={
                  text.editable
                    ? text.text
                    : "Direção de texto ainda não suportada"
                }
              />
            ))}
          {!rendering &&
            !disabled &&
            tool === "images" &&
            [...content.images]
              .sort(
                (a, b) =>
                  (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]) -
                  (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]),
              )
              .map((image) => (
                <button
                  key={image.id}
                  className="image-target"
                  style={position(image.rect)}
                  aria-label={`Selecionar imagem ${image.id.replace("image-", "")}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onImage(image);
                  }}
                >
                  <span>Imagem</span>
                </button>
              ))}
          {rendering && (
            <div className="page-loading">
              <LoaderCircle className="spin" size={25} />
              <span>Carregando página…</span>
            </div>
          )}
        </div>
        <span className="page-caption">Página {page}</span>
      </div>
    </div>
  );
}
