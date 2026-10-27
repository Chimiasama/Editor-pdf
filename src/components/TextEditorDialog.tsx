import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { Modal } from "./Modal";
import type { PdfClient } from "../engine/client";
import type {
  PdfEdit,
  Rect,
  TextRun,
  TextBlock,
  TextBoxEdit,
  TextBoxLayout,
} from "../engine/types";
export type TextSelection = {
  run?: TextRun | TextBlock;
  point?: [number, number];
};
interface Props {
  client: PdfClient;
  page: number;
  bounds: Rect;
  selection: TextSelection;
  busy: boolean;
  error: string;
  onClose: () => void;
  onApply: (edit: PdfEdit) => void;
}

export function TextEditorDialog({
  client,
  page,
  bounds,
  selection,
  busy,
  error,
  onClose,
  onApply,
}: Props) {
  const { run, point } = selection;
  const block = run && "runIds" in run ? (run as TextBlock) : undefined;
  const [text, setText] = useState(run?.text || "");
  const [size, setSize] = useState(run ? Math.round(run.size * 10) / 10 : 12);
  const [color, setColor] = useState(run?.color || "#171717");
  const [fit, setFit] = useState(!!run);
  const [align, setAlign] = useState<"left" | "center" | "right">(
    block?.align || "left",
  );
  const [spacing, setSpacing] = useState(
    block
      ? Math.max(
          1,
          Math.min(2.5, Number((block.lineHeight / block.size).toFixed(2))),
        )
      : 1.25,
  );
  const x = run?.rect[0] ?? point![0],
    y = run?.rect[1] ?? point![1];
  const [width, setWidth] = useState(
    run ? run.rect[2] - run.rect[0] : Math.min(300, bounds[2] - x - 4),
  );
  const [height, setHeight] = useState(
    run ? run.rect[3] - run.rect[1] : Math.min(120, bounds[3] - y - 4),
  );
  const [layout, setLayout] = useState<TextBoxLayout | null>(null);
  const [layoutError, setLayoutError] = useState("");
  const [checking, setChecking] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const multiline = !!block || !run;
  const edit = useMemo<
    TextBoxEdit | Extract<PdfEdit, { type: "replace-text" }>
  >(
    () =>
      run && !block
        ? {
            type: "replace-text",
            page,
            id: run.id,
            original: run.text,
            text,
            size,
            color,
            fit,
          }
        : {
            ...(block
              ? {
                  type: "replace-block" as const,
                  id: block.id,
                  original: block.text,
                }
              : { type: "insert-block" as const }),
            page,
            text,
            size,
            color,
            fit,
            align,
            lineSpacing: spacing,
            rect: [x, y, x + width, y + height],
          },
    [
      run,
      block,
      page,
      text,
      size,
      color,
      fit,
      align,
      spacing,
      width,
      height,
      x,
      y,
    ],
  );
  useEffect(() => {
    if (!multiline) return;
    let cancelled = false;
    setChecking(true);
    setLayout(null);
    setLayoutError("");
    const timer = setTimeout(() => {
      client
        .call("layout", { edit: edit as TextBoxEdit, preview: showPreview })
        .then((result) => {
          if (!cancelled) {
            setLayout(result);
            setChecking(false);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setLayoutError(e.message);
            setChecking(false);
          }
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, edit, multiline, showPreview]);
  useEffect(() => {
    const raster = layout?.preview;
    if (!canvas.current || !raster) return;
    canvas.current.width = raster.width;
    canvas.current.height = raster.height;
    canvas.current
      .getContext("2d")
      ?.putImageData(
        new ImageData(
          new Uint8ClampedArray(raster.pixels),
          raster.width,
          raster.height,
        ),
        0,
        0,
      );
  }, [layout, showPreview]);
  const valid =
    !!text.trim() &&
    (!multiline || (!checking && !!layout?.fits && !layoutError));
  return (
    <Modal
      className="text-editor-dialog"
      title={
        block ? "Editar parágrafo" : run ? "Editar trecho" : "Adicionar texto"
      }
      onClose={onClose}
      locked={busy}
      error={error}
    >
      <form
        id="edit-pdf-text-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onApply(edit);
        }}
      >
        <p className="dialog-description">
          {block
            ? `${block.lineCount} ${block.lineCount === 1 ? "linha selecionada" : "linhas selecionadas"}. As palavras serão redistribuídas dentro da área do bloco.`
            : run
              ? "Correção pontual de uma linha. Use Parágrafos para editar várias linhas juntas."
              : "Escreva com várias linhas. O texto será distribuído na área escolhida."}
        </p>
        <label className="field">
          {multiline ? "Texto do bloco" : "Texto do trecho"}
          <textarea
            autoFocus
            aria-label="Texto do trecho"
            rows={multiline ? 5 : 2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={multiline ? 12000 : 2000}
          />
        </label>
        <div className="form-row">
          <label className="field">
            Tamanho (pt)
            <input
              aria-label="Tamanho da fonte"
              type="number"
              min="4"
              max="144"
              step=".1"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              required
            />
          </label>
          <label className="field color-field">
            Cor
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
          {multiline && (
            <div className="field">
              Alinhamento
              <div className="alignment-control">
                {(
                  [
                    ["left", "Esquerda", AlignLeft],
                    ["center", "Centro", AlignCenter],
                    ["right", "Direita", AlignRight],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    type="button"
                    key={value}
                    aria-label={
                      value === "center"
                        ? "Centralizar texto"
                        : `Alinhar à ${label.toLowerCase()}`
                    }
                    aria-pressed={align === value}
                    className={align === value ? "active" : ""}
                    onClick={() => setAlign(value)}
                  >
                    <Icon size={17} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={fit}
            onChange={(e) => setFit(e.target.checked)}
          />
          Ajustar o tamanho ao espaço original
        </label>
        {multiline && (
          <>
            <details className="text-area-options">
              <summary>Ajustar espaço e entrelinhas</summary>
              <p className="field-note">
                O bloco mantém a posição inicial. Amplie o espaço livre; outros
                textos não serão movidos.
              </p>
              <div className="form-row">
                <label className="field">
                  Largura (pt)
                  <input
                    aria-label="Largura do bloco"
                    type="number"
                    min="1"
                    max={Math.floor(bounds[2] - x)}
                    step=".1"
                    value={Math.round(width * 10) / 10}
                    onChange={(e) => setWidth(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Altura (pt)
                  <input
                    aria-label="Altura do bloco"
                    type="number"
                    min="1"
                    max={Math.floor(bounds[3] - y)}
                    step=".1"
                    value={Math.round(height * 10) / 10}
                    onChange={(e) => setHeight(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Entrelinhas
                  <input
                    aria-label="Entrelinhas"
                    type="number"
                    min="1"
                    max="2.5"
                    step=".01"
                    value={spacing}
                    onChange={(e) => setSpacing(Number(e.target.value))}
                  />
                </label>
              </div>
            </details>
            <div
              className={`layout-status ${layoutError || (layout && !layout.fits) ? "overflow" : ""}`}
              role="status"
              aria-live="polite"
            >
              {checking ? (
                <>
                  <LoaderCircle className="spin" size={14} />
                  Verificando espaço…
                </>
              ) : (
                layoutError ||
                (layout ? (
                  <>
                    <span>
                      {layout.fits && <Check size={14} />} {layout.message}
                    </span>
                    <small>
                      {layout.lines.length}{" "}
                      {layout.lines.length === 1 ? "linha" : "linhas"} ·{" "}
                      {layout.fontSize.toFixed(1)} pt
                    </small>
                  </>
                ) : (
                  ""
                ))
              )}
            </div>
            <details
              className="text-preview"
              onToggle={(e) => setShowPreview(e.currentTarget.open)}
            >
              <summary>Ver prévia do bloco</summary>
              <p className="field-note">
                Texto renderizado com a fonte do PDF, dentro da área escolhida.
                O fundo da página será preservado.
              </p>
              {checking ? (
                <span className="field-note">Preparando prévia…</span>
              ) : (
                layout?.preview && (
                  <canvas ref={canvas} aria-label="Prévia do texto editado" />
                )
              )}
            </details>
          </>
        )}
        <p className="field-note">
          {run && <>Fonte original: {run.fontName}. </>}
          {layout?.equivalentFont
            ? "Será usada uma fonte equivalente para manter os caracteres corretos."
            : "As quebras de linha digitadas são preservadas."}
        </p>
      </form>
      <div className="dialog-actions">
        {run && (
          <button
            className="button danger subtle"
            type="button"
            disabled={busy}
            onClick={() =>
              onApply({
                ...edit,
                text: "",
                size: run!.size,
                color: run!.color,
                ...("rect" in edit && run
                  ? {
                      rect: run.rect,
                      lineSpacing: block
                        ? Math.max(
                            1,
                            Math.min(2.5, block.lineHeight / block.size),
                          )
                        : 1.25,
                    }
                  : {}),
              })
            }
          >
            <Trash2 size={16} />
            Apagar texto
          </button>
        )}
        <button
          className="button secondary"
          type="button"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy || !valid}
          type="submit"
          form="edit-pdf-text-form"
        >
          Aplicar alteração
        </button>
      </div>
    </Modal>
  );
}
