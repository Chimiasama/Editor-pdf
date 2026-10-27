import type {
  Rect,
  TextBlock,
  TextRun,
  TextBoxLayout,
  TextBoxOptions,
  TextBlockHint,
} from "./types";

export const foldText = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
export function unionRects(rects: Rect[]): Rect {
  return [
    Math.min(...rects.map((r) => r[0])),
    Math.min(...rects.map((r) => r[1])),
    Math.max(...rects.map((r) => r[2])),
    Math.max(...rects.map((r) => r[3])),
  ];
}
/** Native PDF text blocks plus conservative geometry/style checks avoid joining columns or headings. */
export function buildTextBlocks(
  runs: TextRun[],
  hints: TextBlockHint[] = [],
): TextBlock[] {
  const used = new Set<string>();
  const hinted: TextBlock[] = [];
  for (const hint of hints) {
    const assigned = new Set<string>();
    const lines = hint.lineRects.map((rect) =>
      runs.filter((r) => {
        const matches =
          !used.has(r.id) &&
          !assigned.has(r.id) &&
          r.editable &&
          r.origin[1] >= rect[1] - 0.5 &&
          r.origin[1] <= rect[3] + 0.5 &&
          r.rect[0] >= rect[0] - 0.5 &&
          r.rect[2] <= rect[2] + 0.5;
        if (matches) assigned.add(r.id);
        return matches;
      }),
    );
    const selected = lines.flat();
    if (
      !selected.length ||
      selected.some(
        (r) =>
          r.fontName !== selected[0].fontName ||
          Math.abs(r.size - selected[0].size) > 0.1 ||
          r.color !== selected[0].color,
      )
    )
      continue;
    selected.forEach((r) => used.add(r.id));
    const first = selected[0];
    let text = "";
    lines.forEach((line, i) => {
      text +=
        (i ? (hint.separators[i] ?? " ") : "") +
        line.map((r) => r.text).join("");
    });
    hinted.push({
      ...first,
      id: "",
      text,
      runIds: selected.map((r) => r.id),
      rect: hint.rect,
      lineCount: hint.lineRects.length,
      lineHeight: hint.lineHeight,
      align: hint.align,
    });
  }
  const groups: TextRun[][] = [];
  for (const run of runs.filter((r) => !used.has(r.id))) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    const sameStyle =
      previous &&
      previous.fontName === run.fontName &&
      Math.abs(previous.size - run.size) < 0.1 &&
      previous.color === run.color;
    const gap = previous ? run.origin[1] - previous.origin[1] : 0;
    const overlap = previous
      ? Math.min(previous.rect[2], run.rect[2]) -
        Math.max(previous.rect[0], run.rect[0])
      : 0;
    const canJoin =
      previous &&
      run.editable &&
      previous.editable &&
      sameStyle &&
      run.blockId === previous.blockId &&
      run.lineId !== previous.lineId &&
      gap >= run.size * 0.6 &&
      gap <= run.size * 2.6 &&
      (Math.abs(run.origin[0] - previous.origin[0]) <= run.size * 2 ||
        Math.abs(
          (run.rect[0] + run.rect[2] - previous.rect[0] - previous.rect[2]) / 2,
        ) <= run.size ||
        Math.abs(run.rect[2] - previous.rect[2]) <= run.size) &&
      overlap > 0;
    if (canJoin) group!.push(run);
    else groups.push([run]);
  }
  const native = groups.map((group, index) => {
    const first = group[0];
    const last = group.at(-1)!;
    const rect = unionRects(group.map((r) => r.rect));
    const lineHeight =
      group.length > 1
        ? (last.origin[1] - first.origin[1]) / (group.length - 1)
        : first.size * 1.25;
    // Detected line breaks are soft wraps. Blank-separated/native-separated blocks stay independent.
    return {
      ...first,
      id: `block-${index}`,
      runIds: group.map((r) => r.id),
      text: group.map((r) => r.text.trim()).join(" "),
      rect,
      lineCount: group.length,
      lineHeight,
    };
  });
  return [...hinted, ...native]
    .sort((a, b) => a.rect[1] - b.rect[1] || a.rect[0] - b.rect[0])
    .map((b, i) => ({ ...b, id: `block-${i}` }));
}

export function layoutTextBox(
  text: string,
  options: TextBoxOptions,
  measure: (text: string, size: number) => number,
  ascent = 1.075,
  descent = 0.3,
): TextBoxLayout {
  const {
    rect,
    size,
    fit = false,
    align = "left",
    lineSpacing = 1.25,
  } = options;
  if (
    !rect.every(Number.isFinite) ||
    rect[2] - rect[0] < 1 ||
    rect[3] - rect[1] < 1
  )
    throw new Error("A área de texto precisa ter largura e altura positivas.");
  if (!Number.isFinite(size) || size < 4 || size > 144)
    throw new Error("Use um tamanho de fonte entre 4 e 144.");
  if (!Number.isFinite(lineSpacing) || lineSpacing < 1 || lineSpacing > 2.5)
    throw new Error("Use entrelinhas entre 1 e 2,5.");
  if (!["left", "center", "right"].includes(align))
    throw new Error("Alinhamento inválido.");
  if (text.length > 12000)
    throw new Error("Use até 12 mil caracteres por bloco.");
  const width = rect[2] - rect[0],
    height = rect[3] - rect[1];
  const build = (fontSize: number) => {
    const lines: string[] = [];
    const separators: string[] = [];
    let separator = "";
    const push = (line: string) => {
      lines.push(line);
      separators.push(lines.length === 1 ? "" : separator);
    };
    for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        const joined = line ? `${line} ${word}` : word;
        if (measure(joined, fontSize) <= width + 0.02) {
          line = joined;
          continue;
        }
        if (line) {
          push(line);
          line = "";
          separator = " ";
        }
        let part = "";
        for (const char of Array.from(word)) {
          if (part && measure(part + char, fontSize) > width + 0.02) {
            push(part);
            part = "";
            separator = "";
          }
          part += char;
        }
        line = part;
      }
      push(line);
      separator = "\n";
      // Very large paste in a small box must remain bounded during live preflight.
      if (lines.length > 12000) break;
    }
    const lineHeight = fontSize * lineSpacing;
    const bottom =
      (lines.length - 1) * lineHeight + (ascent + descent) * fontSize;
    const fits =
      bottom <= height + 0.1 &&
      lines.every((line) => measure(line, fontSize) <= width + 0.02);
    const positions = lines.map((line, i) => {
      const lineWidth = measure(line, fontSize);
      const x =
        rect[0] +
        (align === "center"
          ? (width - lineWidth) / 2
          : align === "right"
            ? width - lineWidth
            : 0);
      const baseline = rect[1] + ascent * fontSize + i * lineHeight;
      return {
        text: line,
        x,
        baseline,
        width: lineWidth,
        separatorBefore: separators[i],
        rect: [
          x,
          baseline - ascent * fontSize,
          x + lineWidth,
          baseline + descent * fontSize,
        ] as Rect,
      };
    });
    return {
      lines: positions,
      fontSize,
      lineHeight,
      requiredHeight: bottom,
      fits,
      rect,
      message: fits
        ? "O texto cabe na área escolhida."
        : "O texto não cabe nesta área. Aumente o espaço, reduza a fonte ou ative o ajuste automático.",
    };
  };
  let result = build(size);
  const minimum = Math.min(size, 6);
  if (!result.fits && fit && size > minimum) {
    let low = minimum,
      high = size;
    const smallest = build(low);
    if (smallest.fits) {
      result = smallest;
      for (let i = 0; i < 14; i++) {
        const mid = (low + high) / 2;
        const trial = build(mid);
        if (trial.fits) {
          low = mid;
          result = trial;
        } else high = mid;
      }
      result.message = `O texto cabe com a fonte ajustada para ${result.fontSize.toFixed(1)} pt.`;
    }
  }
  return result;
}
