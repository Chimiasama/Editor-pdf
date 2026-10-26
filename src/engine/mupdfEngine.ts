import * as mupdf from "mupdf";
import type {
  Rect,
  TextRun,
  PageContent,
  PdfInfo,
  PdfEdit,
  EditResult,
  RenderedPage,
} from "./types";

interface InternalRun extends TextRun {
  font: mupdf.Font;
  quads: mupdf.Quad[];
}
const number = (n: number) => {
  if (!Number.isFinite(n)) throw new Error("Coordenada inválida.");
  return Number(n.toFixed(5));
};
const matrix = (m: mupdf.Matrix) => m.map(number).join(" ");
function hexColor(color: mupdf.Color): string {
  let rgb: number[] = color;
  if (color.length === 1) rgb = [color[0], color[0], color[0]];
  if (color.length === 4)
    rgb = [
      1 - Math.min(1, color[0] + color[3]),
      1 - Math.min(1, color[1] + color[3]),
      1 - Math.min(1, color[2] + color[3]),
    ];
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round(Math.min(1, Math.max(0, n)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function pdfColor(hex: string) {
  if (!/^#[a-f0-9]{6}$/i.test(hex)) throw new Error("Cor inválida.");
  return [1, 3, 5]
    .map((i) => number(parseInt(hex.slice(i, i + 2), 16) / 255))
    .join(" ");
}
function intersect(a: Rect, b: Rect) {
  return (
    a[0] < b[2] - 0.1 &&
    a[2] > b[0] + 0.1 &&
    a[1] < b[3] - 0.1 &&
    a[3] > b[1] + 0.1
  );
}
function copyDictionary(doc: mupdf.PDFDocument, source: mupdf.PDFObject) {
  const result = doc.newDictionary();
  source.forEach((value, key) => {
    result.put(key, value);
  });
  return result;
}

/** MuPDF lives in a dedicated worker in the browser. This module also runs in Node for content-level tests. */
export class MuPdfEngine {
  private document?: mupdf.PDFDocument;
  private get doc() {
    if (!this.document) throw new Error("Abra um PDF primeiro.");
    return this.document;
  }
  close() {
    this.document?.destroy();
    this.document = undefined;
    mupdf.emptyStore();
  }
  open(bytes: Uint8Array, password?: string): PdfInfo {
    const next = new mupdf.PDFDocument(bytes);
    try {
      if (
        next.needsPassword() &&
        (!password || !next.authenticatePassword(password))
      )
        throw new Error(
          password ? "Senha incorreta. Tente novamente." : "PASSWORD_REQUIRED",
        );
      const pageCount = next.countPages();
      if (!pageCount) throw new Error("Este PDF não contém páginas.");
      const outline: PdfInfo["outline"] = [];
      const visit = (items: ReturnType<mupdf.PDFDocument["loadOutline"]>) => {
        for (const item of items || []) {
          const page = item.uri
            ? next.resolveLink(item.uri) + 1
            : (item.page ?? -1) + 1;
          if (page >= 1 && page <= pageCount)
            outline.push({ title: item.title || `Página ${page}`, page });
          if (item.down) visit(item.down);
        }
      };
      try {
        visit(next.loadOutline());
      } catch {
        /* Broken bookmarks must not block a valid PDF. */
      }
      this.close();
      this.document = next;
      next.enableJournal();
      return { pageCount, canEdit: next.hasPermission("edit"), outline };
    } catch (error) {
      next.destroy();
      throw error;
    }
  }
  history() {
    return { canUndo: this.doc.canUndo(), canRedo: this.doc.canRedo() };
  }
  private extract(page: mupdf.PDFPage) {
    const runs: InternalRun[] = [];
    const images: PageContent["images"] = [];
    const structured = page.toStructuredText("preserve-images,preserve-spans");
    let current: InternalRun | undefined;
    let horizontal = true;
    const end = () => {
      if (current) {
        if (current.text.trim()) runs.push(current);
        else current.font.destroy();
        current = undefined;
      }
    };
    try {
      structured.walk({
        beginLine(_bbox, wmode, direction) {
          end();
          horizontal =
            wmode === 0 && Math.abs(direction[1]) < 0.01 && direction[0] > 0.99;
        },
        onChar(c, origin, font, size, quad, color, bidi) {
          const fontName = font.getName();
          const hex = hexColor(color);
          if (
            current &&
            (current.fontName !== fontName ||
              Math.abs(current.size - size) > 0.1 ||
              current.color !== hex ||
              Math.abs(current.origin[1] - origin[1]) > 0.5)
          )
            end();
          const xs = [quad[0], quad[2], quad[4], quad[6]];
          const ys = [quad[1], quad[3], quad[5], quad[7]];
          const rect: Rect = [
            Math.min(...xs),
            Math.min(...ys),
            Math.max(...xs),
            Math.max(...ys),
          ];
          if (!current)
            current = {
              id: `text-${runs.length}`,
              text: "",
              rect,
              origin,
              fontName,
              size,
              color: hex,
              editable: horizontal && bidi === 0,
              font,
              quads: [],
            };
          else {
            current.rect = [
              Math.min(current.rect[0], rect[0]),
              Math.min(current.rect[1], rect[1]),
              Math.max(current.rect[2], rect[2]),
              Math.max(current.rect[3], rect[3]),
            ];
            font.destroy();
          }
          current.text += c;
          current.quads.push(quad);
        },
        endLine: end,
        onImageBlock(rect, _transform, image) {
          images.push({
            id: `image-${images.length}`,
            rect,
            width: image.getWidth(),
            height: image.getHeight(),
          });
          image.destroy();
        },
      });
      end();
      return { runs, images };
    } catch (e) {
      end();
      for (const run of runs) run.font.destroy();
      throw e;
    } finally {
      structured.destroy();
    }
  }
  content(pageNumber: number): PageContent {
    const page = this.page(pageNumber);
    try {
      const { runs, images } = this.extract(page);
      const texts = runs.map(({ font, quads: _quads, ...run }) => {
        font.destroy();
        return run;
      });
      return { bounds: page.getBounds(), texts, images };
    } finally {
      page.destroy();
    }
  }
  private page(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > this.doc.countPages())
      throw new Error("Página inválida.");
    return this.doc.loadPage(n - 1);
  }
  render(pageNumber: number, scale: number): RenderedPage {
    const page = this.page(pageNumber);
    try {
      const bounds = page.getBounds();
      // Limit the raster to ~5 megapixels to protect mobile memory, regardless of zoom or page size.
      const actualScale = Math.min(
        Math.max(0.1, scale),
        Math.sqrt(
          5_000_000 / ((bounds[2] - bounds[0]) * (bounds[3] - bounds[1])),
        ),
      );
      const pixmap = page.toPixmap(
        mupdf.Matrix.scale(actualScale, actualScale),
        mupdf.ColorSpace.DeviceRGB,
        true,
      );
      try {
        return {
          width: pixmap.getWidth(),
          height: pixmap.getHeight(),
          pixels: pixmap.getPixels().slice(),
        };
      } finally {
        pixmap.destroy();
      }
    } finally {
      page.destroy();
    }
  }
  private resources(
    page: mupdf.PDFPage,
    group: "Font" | "XObject",
    object: mupdf.PDFObject,
  ) {
    const pageObject = page.getObject();
    const inherited = pageObject.getInheritable("Resources");
    const resources = copyDictionary(this.doc, inherited);
    const oldGroup = resources.get(group);
    const entries = copyDictionary(this.doc, oldGroup);
    const name = `EditPDF${this.doc.countObjects()}`;
    try {
      entries.put(name, object);
      resources.put(group, entries);
      pageObject.put("Resources", resources);
    } finally {
      entries.destroy();
      oldGroup.destroy();
      resources.destroy();
      inherited.destroy();
      pageObject.destroy();
    }
    return name;
  }
  private addContent(page: mupdf.PDFPage, content: string, background = false) {
    const obj = page.getObject();
    const previous = obj.get("Contents");
    const array = this.doc.newArray();
    const start = this.doc.addStream("q\n", {});
    const end = this.doc.addStream("\nQ\n", {});
    const stream = this.doc.addStream(content, {});
    try {
      if (background) array.push(stream);
      array.push(start);
      if (previous.isArray()) previous.forEach((value) => array.push(value));
      else if (!previous.isNull()) array.push(previous);
      array.push(end);
      if (!background) array.push(stream);
      obj.put("Contents", array);
    } finally {
      obj.destroy();
      previous.destroy();
      array.destroy();
      start.destroy();
      end.destroy();
      stream.destroy();
    }
  }
  private replacementFont(
    page: mupdf.PDFPage,
    source: mupdf.Font,
    text: string,
  ) {
    // A font obtained from StructuredText can carry a PDF-specific, remapped cmap.
    // Re-embedding it directly can render e.g. ã as ª even though extraction is right.
    // Reload embedded font bytes to get the actual Unicode cmap; otherwise use a fresh base font.
    const normalize = (name: string) =>
      name
        .replace(/^[A-Z]{6}\+/, "")
        .replace(/[^a-z0-9]/gi, "")
        .toLowerCase();
    const target = normalize(source.getName());
    let embedded: mupdf.Font | undefined;
    const pageObject = page.getObject();
    const resources = pageObject.getInheritable("Resources");
    const seen = new Set<number>();
    const visit = (res: mupdf.PDFObject, depth: number) => {
      if (embedded || depth > 6) return;
      const fonts = res.get("Font");
      try {
        fonts.forEach((fontObject) => {
          if (embedded) return;
          const baseFont = fontObject.get("BaseFont");
          const matches = normalize(baseFont.asName()) === target;
          baseFont.destroy();
          if (!matches) return;
          const descendant = fontObject.get("DescendantFonts", 0);
          const descriptor = (
            descendant.isNull() ? fontObject : descendant
          ).get("FontDescriptor");
          try {
            if (descriptor.isNull()) return;
            for (const key of ["FontFile2", "FontFile3", "FontFile"]) {
              const stream = descriptor.get(key);
              try {
                if (!stream.isStream()) continue;
                const buffer = stream.readStream();
                try {
                  const candidate = new mupdf.Font(
                    source.getName(),
                    buffer.asUint8Array(),
                  );
                  if (
                    Array.from(text).every((c) =>
                      candidate.encodeCharacter(c.codePointAt(0)!),
                    )
                  ) {
                    embedded = candidate;
                    break;
                  }
                  candidate.destroy();
                } catch {
                  /* Unsupported font format: use the fresh equivalent below. */
                } finally {
                  buffer.destroy();
                }
              } finally {
                stream.destroy();
              }
            }
          } finally {
            descriptor.destroy();
            descendant.destroy();
          }
        });
      } finally {
        fonts.destroy();
      }
      if (embedded) return;
      const objects = res.get("XObject");
      try {
        objects.forEach((object) => {
          if (embedded) return;
          const id = object.asIndirect();
          if (id && seen.has(id)) return;
          if (id) seen.add(id);
          const nested = object.get("Resources");
          try {
            if (!nested.isNull()) visit(nested, depth + 1);
          } finally {
            nested.destroy();
          }
        });
      } finally {
        objects.destroy();
      }
    };
    try {
      visit(resources, 0);
    } finally {
      resources.destroy();
      pageObject.destroy();
    }
    if (embedded) return { font: embedded, equivalent: false };
    const family = source.isMono()
      ? "Courier"
      : source.isSerif()
        ? "Times"
        : "Helvetica";
    const name =
      family === "Times"
        ? source.isBold()
          ? source.isItalic()
            ? "Times-BoldItalic"
            : "Times-Bold"
          : source.isItalic()
            ? "Times-Italic"
            : "Times-Roman"
        : family +
          (source.isBold()
            ? source.isItalic()
              ? "-BoldOblique"
              : "-Bold"
            : source.isItalic()
              ? "-Oblique"
              : "");
    return { font: new mupdf.Font(name), equivalent: true };
  }
  private writeText(
    page: mupdf.PDFPage,
    font: mupdf.Font,
    text: string,
    size: number,
    origin: [number, number],
    color: string,
    maxWidth: number,
    fit: boolean,
  ) {
    if (!Number.isFinite(size) || size < 4 || size > 144)
      throw new Error("Use um tamanho de fonte entre 4 e 144.");
    if (/[\r\n]/.test(text))
      throw new Error(
        "Edite uma linha por vez. Para outro parágrafo, adicione um novo texto.",
      );
    const chars = Array.from(text);
    const glyphs = chars.map((c) => font.encodeCharacter(c.codePointAt(0)!));
    if (glyphs.some((g) => g === 0))
      throw new Error(
        "A fonte não contém um dos caracteres digitados. Use letras, números e pontuação suportados.",
      );
    const advance = glyphs.reduce(
      (total, g) => total + font.advanceGlyph(g),
      0,
    );
    const fittedSize =
      fit && advance > 0 ? Math.min(size, maxWidth / advance) : size;
    if (fittedSize < 4 || advance * fittedSize > maxWidth + 0.1)
      throw new Error(
        "O texto não cabe neste espaço. Encurte o texto ou reduza a fonte.",
      );
    const ref = this.doc.addFont(font);
    try {
      const name = this.resources(page, "Font", ref);
      const transform = mupdf.Matrix.concat(
        [1, 0, 0, -1, origin[0], origin[1]],
        mupdf.Matrix.invert(page.getTransform()),
      );
      const hex = glyphs.map((g) => g.toString(16).padStart(4, "0")).join("");
      this.addContent(
        page,
        `q\n${pdfColor(color)} rg\nBT /${name} ${number(fittedSize)} Tf ${matrix(transform)} Tm <${hex}> Tj ET\nQ\n`,
      );
      return fittedSize;
    } finally {
      ref.destroy();
    }
  }
  edit(edit: PdfEdit): EditResult {
    if (!this.doc.hasPermission("edit"))
      throw new Error(
        "Este PDF restringe a edição. Abra uma cópia com permissão de alteração.",
      );
    const page = this.page(edit.page);
    this.doc.beginOperation(edit.type);
    let message = "Alteração aplicada";
    try {
      if (edit.type === "replace-text") {
        const { runs } = this.extract(page);
        let fallback: mupdf.Font | undefined;
        try {
          const run = runs.find((r) => r.id === edit.id);
          if (!run || run.text !== edit.original)
            throw new Error("A página mudou. Selecione o texto novamente.");
          if (!run.editable)
            throw new Error(
              "Este trecho tem direção ou rotação ainda não suportada.",
            );
          // Reject overlapping text instead of silently erasing another line or layer.
          const centerRects: Rect[] = run.quads.map((q) => {
            const xs = [q[0], q[2], q[4], q[6]],
              ys = [q[1], q[3], q[5], q[7]];
            const y0 = Math.min(...ys),
              y1 = Math.max(...ys);
            return [
              Math.min(...xs) + 0.01,
              y0 + (y1 - y0) * 0.3,
              Math.max(...xs) - 0.01,
              y1 - (y1 - y0) * 0.3,
            ];
          });
          if (
            runs.some(
              (other) =>
                other !== run &&
                centerRects.some((rect) => intersect(rect, other.rect)),
            )
          )
            throw new Error(
              "Há textos sobrepostos nesta região. A edição foi interrompida para preservar a página.",
            );
          const replacement = this.replacementFont(page, run.font, edit.text);
          const font = replacement.font;
          fallback = font;
          if (replacement.equivalent)
            message = "Texto alterado com uma fonte equivalente";
          const annotation = page.createAnnotation("Redact");
          try {
            annotation.setRect(run.rect);
            annotation.setQuadPoints(
              centerRects
                .filter((r) => r[2] > r[0])
                .map(([x0, y0, x1, y1]) => [x0, y0, x1, y0, x0, y1, x1, y1]),
            );
            annotation.applyRedaction(
              0,
              mupdf.PDFPage.REDACT_IMAGE_NONE,
              mupdf.PDFPage.REDACT_LINE_ART_NONE,
              mupdf.PDFPage.REDACT_TEXT_REMOVE,
            );
          } finally {
            annotation.destroy();
          }
          if (edit.text) {
            const finalSize = this.writeText(
              page,
              font,
              edit.text,
              edit.size,
              run.origin,
              edit.color,
              run.rect[2] - run.origin[0],
              edit.fit,
            );
            if (finalSize < edit.size - 0.1)
              message = `Texto alterado · fonte ajustada para ${finalSize.toFixed(1)} pt`;
          } else message = "Texto removido da página";
        } finally {
          fallback?.destroy();
          for (const run of runs) run.font.destroy();
        }
      } else if (edit.type === "insert-text") {
        const bounds = page.getBounds();
        const font = new mupdf.Font("Helvetica");
        try {
          if (
            edit.point[0] < bounds[0] ||
            edit.point[1] < bounds[1] + edit.size ||
            edit.point[1] > bounds[3]
          )
            throw new Error("Escolha uma posição dentro da página.");
          this.writeText(
            page,
            font,
            edit.text,
            edit.size,
            edit.point,
            edit.color,
            bounds[2] - edit.point[0] - 4,
            false,
          );
        } finally {
          font.destroy();
        }
        message = "Texto adicionado";
      } else if (edit.type === "delete-image") {
        const { runs, images } = this.extract(page);
        runs.forEach((r) => r.font.destroy());
        const image = images.find((i) => i.id === edit.id);
        if (!image) throw new Error("Selecione a imagem novamente.");
        if (
          images.some(
            (other) => other !== image && intersect(image.rect, other.rect),
          )
        )
          throw new Error(
            "Esta imagem se sobrepõe a outra. A remoção individual ainda não está disponível neste caso.",
          );
        const annotation = page.createAnnotation("Redact");
        try {
          annotation.setRect(image.rect);
          annotation.applyRedaction(
            0,
            mupdf.PDFPage.REDACT_IMAGE_REMOVE,
            mupdf.PDFPage.REDACT_LINE_ART_NONE,
            mupdf.PDFPage.REDACT_TEXT_NONE,
          );
        } finally {
          annotation.destroy();
        }
        message = "Imagem removida da página";
      } else if (edit.type === "insert-image") {
        const [x0, y0, x1, y1] = edit.rect;
        const bounds = page.getBounds();
        if (
          !(x1 > x0 && y1 > y0) ||
          x0 < bounds[0] ||
          y0 < bounds[1] ||
          x1 > bounds[2] ||
          y1 > bounds[3]
        )
          throw new Error("A imagem precisa caber na página.");
        const image = new mupdf.Image(edit.bytes);
        const ref = this.doc.addImage(image);
        try {
          const name = this.resources(page, "XObject", ref);
          const transform = mupdf.Matrix.concat(
            [x1 - x0, 0, 0, -(y1 - y0), x0, y1],
            mupdf.Matrix.invert(page.getTransform()),
          );
          this.addContent(
            page,
            `q\n${matrix(transform)} cm\n/${name} Do\nQ\n`,
            edit.background,
          );
        } finally {
          ref.destroy();
          image.destroy();
        }
        message = edit.background
          ? "Imagem adicionada ao fundo"
          : "Imagem adicionada";
      } else if (edit.type === "rotate") {
        const obj = page.getObject();
        const rotation = obj.getInheritable("Rotate");
        try {
          obj.put("Rotate", (rotation.asNumber() + 90) % 360);
        } finally {
          rotation.destroy();
          obj.destroy();
        }
        message = "Página girada";
      }
      this.doc.endOperation();
    } catch (error) {
      this.doc.abandonOperation();
      throw error;
    } finally {
      page.destroy();
    }
    return { ...this.history(), message };
  }
  undo() {
    if (this.doc.canUndo()) this.doc.undo();
    return this.history();
  }
  redo() {
    if (this.doc.canRedo()) this.doc.redo();
    return this.history();
  }
  save(): Uint8Array {
    // PDFDocument(existingDoc) shares the native document. Serialize to obtain an independent
    // copy before garbage collection, otherwise saving renumbers objects and breaks undo.
    const snapshot = this.doc.saveToBuffer("compress,encrypt=none");
    const copy = new mupdf.PDFDocument(snapshot.asUint8Array().slice());
    snapshot.destroy();
    try {
      const previous =
        copy.getMetaData(mupdf.Document.META_INFO_PRODUCER) || "";
      copy.setMetaData(
        mupdf.Document.META_INFO_PRODUCER,
        previous.includes("MuPDF")
          ? previous
          : `${previous ? previous + "; " : ""}EditPDF / MuPDF 1.28.1 (Artifex)`,
      );
      const buffer = copy.saveToBuffer("garbage=4,compress");
      try {
        return buffer.asUint8Array().slice();
      } finally {
        buffer.destroy();
      }
    } finally {
      copy.destroy();
    }
  }
}
