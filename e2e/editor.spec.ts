import { test, expect, type Page, type Download } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";
import * as mupdf from "mupdf";
import { readFile } from "node:fs/promises";
function blackImage() {
  const pixmap = new mupdf.Pixmap(
    mupdf.ColorSpace.DeviceRGB,
    [0, 0, 10, 10],
    false,
  );
  pixmap.getPixels().fill(0);
  try {
    return Buffer.from(pixmap.asPNG());
  } finally {
    pixmap.destroy();
  }
}
async function fixture() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 600,
    height: 800,
    color: rgb(0.92, 0.96, 0.91),
  });
  page.drawText("Nome: Joao da Silva", { x: 50, y: 700, size: 18 });
  page.drawText("Um livro para revisar", { x: 50, y: 650, size: 15 });
  const image = await pdf.embedPng(blackImage());
  page.drawImage(image, { x: 100, y: 250, width: 150, height: 100 });
  pdf
    .addPage([600, 800])
    .drawText("Segunda pagina preservada", { x: 50, y: 700, size: 18 });
  return Buffer.from(await pdf.save());
}
async function openFixture(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Abrir arquivo PDF")
    .setInputFiles({
      name: "meu-livro.pdf",
      mimeType: "application/pdf",
      buffer: await fixture(),
    });
  await expect(
    page.getByRole("heading", { name: "meu-livro.pdf", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Carregando página…")).not.toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
}
async function readDownload(download: Download) {
  const bytes = await readFile((await download.path())!);
  const pdf = new mupdf.PDFDocument(bytes);
  const texts: string[] = [];
  let images = 0;
  try {
    for (let i = 0; i < pdf.countPages(); i++) {
      const p = pdf.loadPage(i);
      const text = p.toStructuredText("preserve-images");
      texts.push(text.asText());
      text.walk({
        onImageBlock(_r, _t, img) {
          images++;
          img.destroy();
        },
      });
      text.destroy();
      p.destroy();
    }
    return { text: texts.join("\n"), pages: pdf.countPages(), images };
  } finally {
    pdf.destroy();
  }
}
async function exportPdf(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Salvar cópia", exact: true }).click();
  return readDownload(await pending);
}
async function editName(page: Page, value = "Nome: João de Souza") {
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar: Nome: Joao da Silva", exact: true })
    .click();
  await expect(page.getByLabel("Texto do trecho")).toHaveValue(
    "Nome: Joao da Silva",
  );
  await page.getByLabel("Texto do trecho").fill(value);
  await page
    .getByRole("button", { name: "Aplicar alteração", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo no aparelho" }),
  ).toBeVisible();
}

test("starts with a clean import library and no AI or sample books", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sua biblioteca começa aqui" }),
  ).toBeVisible();
  await expect(page.getByText(/Gemini|Crônicas de Eldoria/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Abrir PDF do aparelho" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "work/library-mobile.png", fullPage: true });
});
test("real text replacement, undo/redo, persistence and export on a mobile viewport", async ({
  page,
}) => {
  await openFixture(page);
  await editName(page);
  await expect(
    page.getByRole("button", {
      name: "Editar: Nome: João de Souza",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Editar: Nome: Joao da Silva",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Editar: Nome: João de Souza",
      exact: true,
    }),
  ).toBeVisible();
  const exported = await exportPdf(page);
  expect(exported.text).toContain("João de Souza");
  expect(exported.text).not.toContain("Joao da Silva");
  expect(exported.text).toContain("Segunda pagina preservada");
  expect(exported.pages).toBe(2);
  expect(exported.images).toBe(1);
  await page.reload();
  await page.getByRole("button").filter({ hasText: "meu-livro.pdf" }).click();
  await expect(page.getByText("Carregando página…")).not.toBeVisible();
  const reopened = await exportPdf(page);
  expect(reopened.text).toContain("João de Souza");
  expect(reopened.text).not.toContain("Joao da Silva");
});
test("adds text, removes an actual image, navigates pages and retains the original backup", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Adicionar texto", exact: true })
    .click();
  const canvas = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(canvas!.x + 35, canvas!.y + 145);
  await page.getByLabel("Texto do trecho").fill("Minha anotação");
  await page
    .getByRole("button", { name: "Aplicar alteração", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo no aparelho" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Imagens", exact: true }).click();
  await page
    .getByRole("button", { name: "Selecionar imagem 0", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remover imagem", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Nenhuma imagem separada foi encontrada.", { exact: false }),
  ).toBeVisible();
  const exported = await exportPdf(page);
  expect(exported.images).toBe(0);
  expect(exported.text).toContain("Minha anotação");
  expect(exported.text).toContain("Joao da Silva");
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page.getByLabel("Número da página")).toHaveValue("2");
  await page.getByRole("button", { name: "Página anterior" }).click();
  await expect(page.getByLabel("Número da página")).toHaveValue("1");
  await page.getByRole("button", { name: "Mais opções" }).click();
  await page
    .getByRole("button", { name: "Restaurar PDF original", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restaurar original", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const original = await exportPdf(page);
  expect(original.images).toBe(1);
  expect(original.text).not.toContain("Minha anotação");
});
test("inserts an image from the device and can remove it again", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Inserir imagem", exact: true })
    .click();
  const box = await page.locator("canvas").boundingBox();
  await page.touchscreen.tap(box!.x + 15, box!.y + 160);
  await page
    .getByLabel("Escolher imagem")
    .setInputFiles({
      name: "desenho.png",
      mimeType: "image/png",
      buffer: blackImage(),
    });
  await expect(page.getByAltText("Prévia da imagem")).toBeVisible();
  await page.getByRole("button", { name: "Inserir na página" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Selecionar imagem/ }),
  ).toHaveCount(2);
  const exported = await exportPdf(page);
  expect(exported.images).toBe(2);
});
test("a scanned page explains why text cannot be edited", async ({ page }) => {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(blackImage());
  pdf
    .addPage([300, 400])
    .drawImage(image, { x: 0, y: 0, width: 300, height: 400 });
  await page.goto("/");
  await page
    .getByLabel("Abrir arquivo PDF")
    .setInputFiles({
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await expect(
    page.getByRole("heading", { name: "scan.pdf", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByText(/Não há texto editável nesta página/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar:/ })).toHaveCount(0);
});
test("invalid PDF fails cleanly and the next import still works", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Abrir arquivo PDF")
    .setInputFiles({
      name: "quebrado.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a PDF"),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await openFixture(page);
  await expect(page.getByRole("alert")).not.toBeVisible();
});
test("reader layout fits mobile, keyboard dialog is contained and desktop layout remains functional", async ({
  page,
}) => {
  await openFixture(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const box = await page.locator("canvas").boundingBox();
  expect(box!.width).toBeLessThan(390);
  expect(box!.width).toBeGreaterThan(300);
  await page.screenshot({ path: "work/reader-mobile.png", fullPage: true });
  await editName(page);
  await page.screenshot({ path: "work/edit-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Ler", exact: true }).click();
  await page.getByRole("button", { name: "Páginas e índice" }).click();
  await expect(
    page.getByRole("heading", { name: "Páginas", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "work/reader-desktop.png", fullPage: true });
});

test("edit errors stay visible inside the dialog and leave original text intact", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar: Nome: Joao da Silva", exact: true })
    .click();
  await page
    .getByLabel("Texto do trecho")
    .fill("Esta frase e longa demais para caber no espaco original da pagina");
  await page.getByLabel("Ajustar o tamanho ao espaço original").uncheck();
  await page
    .getByRole("button", { name: "Aplicar alteração", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "não cabe",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  const exported = await exportPdf(page);
  expect(exported.text).toContain("Joao da Silva");
});
test("password dialog unlocks the file and the exported copy reopens without corruption", async ({
  page,
}) => {
  const raw = new mupdf.PDFDocument(await fixture());
  const buffer = raw.saveToBuffer(
    "encrypt=aes-256,user-password=teste,owner-password=dono",
  );
  const bytes = Buffer.from(buffer.asUint8Array());
  buffer.destroy();
  raw.destroy();
  await page.goto("/");
  await page
    .getByLabel("Abrir arquivo PDF")
    .setInputFiles({
      name: "protegido.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  await expect(
    page.getByRole("dialog", { name: "PDF protegido por senha" }),
  ).toBeVisible();
  await page.getByLabel("Senha", { exact: true }).fill("errada");
  await page
    .getByRole("button", { name: "Abrir documento", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Senha incorreta",
  );
  await page.getByLabel("Senha", { exact: true }).fill("teste");
  await page
    .getByRole("button", { name: "Abrir documento", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "protegido.pdf", exact: true }),
  ).toBeVisible();
  await editName(page);
  const result = await exportPdf(page);
  expect(result.text).toContain("João de Souza");
  expect(result.text).not.toContain("Joao da Silva");
});
