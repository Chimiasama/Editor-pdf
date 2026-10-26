import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import * as m from "mupdf";
import { MuPdfEngine } from "../src/engine/mupdfEngine";
function imageBytes() {
  const pix = new m.Pixmap(m.ColorSpace.DeviceRGB, [0, 0, 8, 8], false);
  pix.getPixels().fill(0);
  try {
    return pix.asPNG().slice();
  } finally {
    pix.destroy();
  }
}
async function fixture(
  options: { image?: boolean; rotated?: boolean; cropped?: boolean } = {},
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 600,
    height: 800,
    color: rgb(0.8, 0.9, 0.7),
  });
  page.drawText("Nome: Joao da Silva", { x: 50, y: 700, size: 18 });
  page.drawText("Outra linha preservada", { x: 50, y: 650, size: 15 });
  if (options.image) {
    const image = await doc.embedPng(imageBytes());
    page.drawImage(image, { x: 100, y: 200, width: 150, height: 100 });
  }
  if (options.rotated) page.setRotation(degrees(90));
  if (options.cropped) page.setCropBox(20, 30, 550, 730);
  doc
    .addPage([300, 400])
    .drawText("Segunda pagina intacta", { x: 20, y: 300, size: 15 });
  return doc.save();
}
function readText(bytes: Uint8Array) {
  const doc = new m.PDFDocument(bytes);
  const values: string[] = [];
  try {
    for (let i = 0; i < doc.countPages(); i++) {
      const p = doc.loadPage(i);
      const st = p.toStructuredText("");
      values.push(st.asText());
      st.destroy();
      p.destroy();
    }
    return values.join("\n");
  } finally {
    doc.destroy();
  }
}
function replace(engine: MuPdfEngine, replacement: string, fit = true) {
  const run = engine.content(1).texts.find((t) => t.text.includes("Joao"))!;
  return engine.edit({
    type: "replace-text",
    page: 1,
    id: run.id,
    original: run.text,
    text: replacement,
    size: run.size,
    color: run.color,
    fit,
  });
}
function pixel(engine: MuPdfEngine, x: number, y: number) {
  const result = engine.render(1, 1);
  return [
    ...result.pixels.slice(
      (y * result.width + x) * 4,
      (y * result.width + x) * 4 + 4,
    ),
  ];
}

test("real replacement removes original searchable text, preserves background, other pages and original input", async () => {
  const bytes = await fixture({ image: true });
  const snapshot = bytes.slice();
  const engine = new MuPdfEngine();
  try {
    assert.equal(engine.open(bytes).pageCount, 2);
    const before = pixel(engine, 51, 90);
    replace(engine, "Nome: João de Souza");
    const saved = engine.save();
    const text = readText(saved);
    assert.match(text, /João de Souza/);
    assert.doesNotMatch(text, /Joao da Silva/);
    assert.match(text, /Outra linha preservada/);
    assert.match(text, /Segunda pagina intacta/);
    assert.equal(engine.content(1).images.length, 1);
    // Sample the background inside the replaced region, away from glyphs.
    assert.deepEqual(pixel(engine, 51, 81), [204, 229, 178, 255]);
    assert.deepEqual(bytes, snapshot);
    assert.ok(before.length);
    const reopened = new MuPdfEngine();
    try {
      reopened.open(saved);
      assert.match(
        reopened
          .content(1)
          .texts.map((t) => t.text)
          .join(" "),
        /João de Souza/,
      );
    } finally {
      reopened.close();
    }
  } finally {
    engine.close();
  }
});
test("undo and redo survive multiple full saves, including undoing the first edit", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    replace(engine, "Nome: Maria");
    engine.save();
    assert.equal(engine.undo().canRedo, true);
    assert.match(readText(engine.save()), /Joao da Silva/);
    engine.redo();
    assert.doesNotMatch(readText(engine.save()), /Joao da Silva/);
    assert.match(readText(engine.save()), /Nome: Maria/);
    engine.undo();
    replace(engine, "Nome: Ana");
    assert.equal(engine.history().canRedo, false);
  } finally {
    engine.close();
  }
});
test("invalid replacement rolls back all destructive changes", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    assert.throws(
      () => replace(engine, "Texto que nao cabe ".repeat(50), false),
      /não cabe/,
    );
    assert.match(readText(engine.save()), /Joao da Silva/);
    assert.equal(engine.history().canUndo, false);
    replace(engine, "");
    assert.doesNotMatch(readText(engine.save()), /Joao da Silva/);
    assert.match(readText(engine.save()), /Outra linha/);
  } finally {
    engine.close();
  }
});
test("image removal removes image content but preserves text and colored background", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture({ image: true }));
    const image = engine.content(1).images[0];
    assert.equal(image.width, 8);
    assert.deepEqual(pixel(engine, 120, 520), [0, 0, 0, 255]);
    engine.edit({ type: "delete-image", page: 1, id: image.id });
    assert.equal(engine.content(1).images.length, 0);
    assert.deepEqual(pixel(engine, 120, 520), [204, 229, 178, 255]);
    assert.match(readText(engine.save()), /Joao da Silva/);
    engine.undo();
    assert.equal(engine.content(1).images.length, 1);
    assert.deepEqual(pixel(engine, 120, 520), [0, 0, 0, 255]);
  } finally {
    engine.close();
  }
});
test("inserted images respect foreground/background order; text additions remain editable", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture());
    const bytes = imageBytes();
    engine.edit({
      type: "insert-image",
      page: 1,
      bytes,
      rect: [300, 300, 350, 350],
      background: true,
    });
    assert.deepEqual(pixel(engine, 310, 310), [204, 229, 178, 255]); // opaque existing background covers inserted image
    engine.edit({
      type: "insert-image",
      page: 1,
      bytes,
      rect: [400, 300, 450, 350],
      background: false,
    });
    assert.deepEqual(pixel(engine, 410, 310), [0, 0, 0, 255]);
    engine.edit({
      type: "insert-text",
      page: 1,
      point: [50, 400],
      text: "Adição com ação",
      size: 16,
      color: "#123456",
    });
    const run = engine
      .content(1)
      .texts.find((t) => t.text === "Adição com ação")!;
    assert.ok(run);
    engine.edit({
      type: "replace-text",
      page: 1,
      id: run.id,
      original: run.text,
      text: "Texto revisado",
      size: 16,
      color: "#123456",
      fit: true,
    });
    assert.match(readText(engine.save()), /Texto revisado/);
    assert.doesNotMatch(readText(engine.save()), /Adição com ação/);
  } finally {
    engine.close();
  }
});
test("rotation and crop coordinate transforms preserve editing and history", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture({ cropped: true }));
    replace(engine, "Nome: João");
    assert.match(readText(engine.save()), /Nome: João/);
    engine.edit({ type: "rotate", page: 1 });
    assert.equal(engine.content(1).bounds[2], 730);
    engine.undo();
    assert.equal(engine.content(1).bounds[2], 550);
  } finally {
    engine.close();
  }
});
test("rotated text is exposed without falsely promising editing support", async () => {
  const engine = new MuPdfEngine();
  try {
    engine.open(await fixture({ rotated: true }));
    assert.ok(engine.content(1).texts.every((t) => !t.editable));
  } finally {
    engine.close();
  }
});

test("accented characters use actual glyphs, not a PDF-specific remapped substitute cmap", async () => {
  const engine = new MuPdfEngine();
  const font = new m.Font("Helvetica");
  try {
    engine.open(await fixture());
    const value = "Nome: João";
    replace(engine, value, false);
    const run = engine.content(1).texts.find((t) => t.text === value)!;
    const expected = Array.from(value).reduce(
      (width, c) =>
        width + font.advanceGlyph(font.encodeCharacter(c.codePointAt(0)!)) * 18,
      0,
    );
    assert.ok(
      Math.abs(run.rect[2] - run.rect[0] - expected) < 0.1,
      `Accented glyph width must match the actual font, got ${run.rect[2] - run.rect[0]} expected ${expected}`,
    );
    assert.match(readText(engine.save()), /João/);
  } finally {
    font.destroy();
    engine.close();
  }
});

test("embedded fonts are reloaded with their real Unicode mapping and reused", async () => {
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  const { default: vfs } = await import("pdfmake/build/vfs_fonts");
  const data = Buffer.from(vfs["Roboto-Regular.ttf"], "base64");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const embedded = await pdf.embedFont(data);
  pdf
    .addPage([600, 800])
    .drawText("Nome: Joao da Silva", {
      x: 50,
      y: 700,
      size: 18,
      font: embedded,
    });
  const engine = new MuPdfEngine();
  const font = new m.Font("Roboto-Regular", data);
  try {
    engine.open(await pdf.save());
    const result = replace(engine, "Nome: João", false);
    assert.doesNotMatch(result.message, /equivalente/);
    const run = engine.content(1).texts.find((t) => t.text === "Nome: João")!;
    assert.match(run.fontName, /Roboto/);
    const expected = Array.from(run.text).reduce(
      (w, c) =>
        w + font.advanceGlyph(font.encodeCharacter(c.codePointAt(0)!)) * 18,
      0,
    );
    assert.ok(Math.abs(run.rect[2] - run.rect[0] - expected) < 0.1);
    assert.match(readText(engine.save()), /João/);
  } finally {
    font.destroy();
    engine.close();
  }
});

test("password-protected PDFs authenticate and save a valid unencrypted working copy", async () => {
  const original = new m.PDFDocument(await fixture());
  const buffer = original.saveToBuffer(
    "encrypt=aes-256,user-password=teste,owner-password=dono",
  );
  const bytes = buffer.asUint8Array().slice();
  buffer.destroy();
  original.destroy();
  const engine = new MuPdfEngine();
  try {
    assert.throws(() => engine.open(bytes), /PASSWORD_REQUIRED/);
    assert.throws(() => engine.open(bytes, "errada"), /Senha incorreta/);
    engine.open(bytes, "teste");
    replace(engine, "Nome: João", false);
    const saved = engine.save();
    const reopened = new m.PDFDocument(saved);
    try {
      assert.equal(reopened.needsPassword(), false);
    } finally {
      reopened.destroy();
    }
    assert.match(readText(saved), /Nome: João/);
    assert.doesNotMatch(readText(saved), /Joao da Silva/);
    engine.undo();
    assert.match(readText(engine.save()), /Joao da Silva/);
    const untouched = new m.PDFDocument(bytes);
    try {
      assert.equal(untouched.needsPassword(), true);
    } finally {
      untouched.destroy();
    }
  } finally {
    engine.close();
  }
});
