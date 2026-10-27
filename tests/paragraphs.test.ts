import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, rgb } from "pdf-lib";
import * as m from "mupdf";
import { MuPdfEngine } from "../src/engine/mupdfEngine";
import { foldText, layoutTextBox } from "../src/engine/textLayout";
import type { TextBoxEdit } from "../src/engine/types";

const originalLines = [
  "Primeira linha do paragrafo original para revisar.",
  "Segunda linha do paragrafo original para revisar.",
  "Terceira linha encerra este paragrafo original.",
];
async function fixture() {
  const doc = await PDFDocument.create();
  const p = doc.addPage([600, 800]);
  p.drawRectangle({
    x: 0,
    y: 0,
    width: 600,
    height: 800,
    color: rgb(0.8, 0.9, 0.7),
  });
  p.drawText(originalLines.join("\n"), {
    x: 50,
    y: 700,
    size: 14,
    lineHeight: 20,
  });
  p.drawText("Vizinho preservado.", { x: 50, y: 580, size: 14 });
  p.drawText("Coluna da direita\ncontinua intacta.", {
    x: 440,
    y: 700,
    size: 13,
    lineHeight: 18,
  });
  doc
    .addPage([600, 800])
    .drawText("Segunda pagina original", { x: 40, y: 700, size: 15 });
  return doc.save();
}
function textFrom(bytes: Uint8Array) {
  const doc = new m.PDFDocument(bytes);
  try {
    return Array.from({ length: doc.countPages() }, (_, i) => {
      const page = doc.loadPage(i),
        st = page.toStructuredText("");
      try {
        return st.asText();
      } finally {
        st.destroy();
        page.destroy();
      }
    }).join("\n");
  } finally {
    doc.destroy();
  }
}
function editFor(engine: MuPdfEngine, text: string): TextBoxEdit {
  const block = engine
    .content(1)
    .blocks.find((b) => b.text.startsWith("Primeira"))!;
  return {
    type: "replace-block",
    page: 1,
    id: block.id,
    original: block.text,
    text,
    rect: block.rect,
    size: 14,
    fit: true,
    lineSpacing: block.lineHeight / block.size,
    color: "#123456",
  };
}

test("paragraph detection joins native lines without merging neighbouring paragraphs or columns", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    const blocks = engine.content(1).blocks;
    const main = blocks.find((b) => b.text.startsWith("Primeira"))!;
    assert.equal(main.lineCount, 3);
    assert.equal(main.runIds.length, 3);
    assert.equal(main.text, originalLines.join(" "));
    assert.ok(blocks.some((b) => b.text === "Vizinho preservado."));
    assert.ok(
      blocks.some(
        (b) =>
          b.text.includes("Coluna da direita") && !b.text.includes("Primeira"),
      ),
    );
  } finally {
    engine.close();
  }
});
test("multi-line replacement removes old content, preserves the rest and remains undoable after saving", async () => {
  const engine = new MuPdfEngine();
  const bytes = await fixture(),
    snapshot = bytes.slice();
  try {
    engine.open(bytes);
    const edit = editFor(
      engine,
      "João consegue revisar um parágrafo inteiro, com várias linhas. O texto é distribuído no espaço do bloco e o fundo é preservado.",
    );
    const layout = engine.layout(edit);
    assert.ok(layout.fits);
    assert.ok(layout.lines.length >= 2);
    engine.edit(edit);
    const output = engine.save();
    const text = textFrom(output);
    assert.doesNotMatch(text, /Primeira linha|Segunda linha|Terceira linha/);
    assert.match(text, /João consegue/);
    assert.match(text, /Vizinho preservado/);
    assert.match(text, /Coluna da direita/);
    assert.match(text, /Segunda pagina original/);
    const bitmap = engine.render(1, 1);
    assert.deepEqual(
      [
        ...bitmap.pixels.slice(
          (86 * bitmap.width + 51) * 4,
          (86 * bitmap.width + 51) * 4 + 4,
        ),
      ],
      [204, 229, 178, 255],
    );
    engine.undo();
    assert.match(textFrom(engine.save()), /Primeira linha/);
    engine.redo();
    assert.doesNotMatch(textFrom(engine.save()), /Primeira linha/);
    assert.deepEqual(bytes, snapshot);
  } finally {
    engine.close();
  }
});
test("live layout and actual-font preview are read-only; explicit newlines and blank lines are retained", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    const edit = editFor(engine, "João revisou.\n\nNovo parágrafo com ação.");
    const layout = engine.layout(edit, true);
    assert.equal(layout.fits, true);
    assert.equal(layout.lines[1].text, "");
    assert.ok(layout.preview);
    assert.ok(layout.preview.pixels.some((n, i) => i % 4 !== 3 && n < 200));
    assert.deepEqual(engine.history(), { canUndo: false, canRedo: false });
    assert.match(textFrom(engine.save()), /Primeira linha/);
    engine.edit(edit);
    const text = textFrom(engine.save());
    assert.match(text, /João revisou/);
    assert.match(text, /Novo parágrafo com ação/);
  } finally {
    engine.close();
  }
});
test("overflow, out-of-page boxes and collision with other text fail without losing original content", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    const overflow = {
      ...editFor(engine, "Texto longo demais ".repeat(100)),
      fit: false,
    };
    assert.equal(engine.layout(overflow).fits, false);
    assert.throws(() => engine.edit(overflow), /não cabe/);
    const outside = {
      ...editFor(engine, "Novo texto"),
      rect: [50, 84.94999694824219, 650, 180] as [
        number,
        number,
        number,
        number,
      ],
    };
    assert.throws(() => engine.layout(outside), /caber na página/);
    const collision = editFor(engine, "");
    collision.text = Array.from({ length: 12 }, () => "Uma nova linha.").join(
      "\n",
    );
    collision.rect[3] = 350;
    collision.fit = false;
    const trial = engine.layout(collision);
    assert.equal(trial.fits, false);
    assert.match(trial.message, /outro trecho/);
    assert.throws(() => engine.edit(collision), /outro trecho/);
    assert.match(textFrom(engine.save()), /Primeira linha/);
    assert.equal(engine.history().canUndo, false);
  } finally {
    engine.close();
  }
});
test("alignment and a larger free area can reflow text without moving other paragraphs", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    const edit = editFor(
      engine,
      "Um parágrafo centralizado em várias linhas.\nUma segunda linha curta.",
    );
    edit.align = "center";
    edit.rect[3] += 25;
    edit.fit = false;
    const layout = engine.layout(edit);
    assert.equal(layout.fits, true);
    assert.ok(layout.lines.every((l) => l.x > edit.rect[0]));
    engine.edit(edit);
    const block = engine
      .content(1)
      .blocks.find((b) => b.text.startsWith("Um parágrafo"))!;
    assert.ok(block);
    assert.equal(block.lineCount, layout.lines.length);
    assert.match(textFrom(engine.save()), /Vizinho preservado/);
  } finally {
    engine.close();
  }
});
test("new text blocks support multiple lines, are selectable again, and can be deleted as one edit", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    engine.edit({
      type: "insert-block",
      page: 1,
      rect: [50, 330, 360, 450],
      text: "Minhas notas com ação e coração.\nSegunda linha das notas.",
      size: 15,
      color: "#000000",
      align: "right",
      lineSpacing: 1.3,
    });
    const block = engine
      .content(1)
      .blocks.find((b) => b.text.startsWith("Minhas notas"))!;
    assert.ok(block);
    assert.equal(block.lineCount, 2);
    engine.edit({
      type: "replace-block",
      page: 1,
      id: block.id,
      original: block.text,
      text: "",
      rect: block.rect,
      size: block.size,
      color: block.color,
    });
    assert.doesNotMatch(textFrom(engine.save()), /Minhas notas/);
    engine.undo();
    assert.match(textFrom(engine.save()), /Minhas notas/);
  } finally {
    engine.close();
  }
});
test("wrapping keeps unicode and long words; page search treats accented letters consistently", () => {
  const word = "ação".repeat(15);
  const result = layoutTextBox(
    word,
    { rect: [0, 0, 40, 400], size: 10 },
    (text, size) => Array.from(text).length * size * 0.5,
  );
  assert.equal(result.fits, true);
  assert.equal(result.lines.map((l) => l.text).join(""), word);
  assert.ok(result.lines.length > 1);
  assert.equal(foldText("João, AÇÃO e CORAÇÃO"), "joao, acao e coracao");
});

test("tight leading never duplicates a line and block structure survives export/reimport", async () => {
  const engine = new MuPdfEngine();
  const reopened = new MuPdfEngine();
  try {
    engine.open(await fixture());
    const text =
      "João, ação e coração.\nSegunda linha revisada.\nTerceira linha revisada.";
    const edit = editFor(engine, text);
    edit.lineSpacing = 1;
    edit.fit = false;
    engine.edit(edit);
    const saved = engine.save();
    reopened.open(saved);
    const block = reopened
      .content(1)
      .blocks.find((b) => b.text.startsWith("João"))!;
    assert.ok(block);
    assert.equal(block.text, text);
    assert.equal(new Set(block.runIds).size, block.runIds.length);
    const doc = new m.PDFDocument(saved);
    const page = doc.loadPage(0);
    const object = page.getObject();
    const hints = object.get("EditPDFTextBlocks");
    try {
      assert.doesNotMatch(
        JSON.stringify(hints.asJS()),
        /Primeira|João|revisada/,
      );
    } finally {
      hints.destroy();
      object.destroy();
      page.destroy();
      doc.destroy();
    }
  } finally {
    engine.close();
    reopened.close();
  }
});
