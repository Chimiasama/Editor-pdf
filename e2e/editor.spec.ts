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
  await page.getByLabel("Abrir arquivo PDF").setInputFiles({
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
  await page.getByLabel("Escolher imagem").setInputFiles({
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
  await page.getByLabel("Abrir arquivo PDF").setInputFiles({
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
  await page.getByLabel("Abrir arquivo PDF").setInputFiles({
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

test("overflow is explained before applying and leaves original text intact", async ({
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
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "não cabe",
  );
  await expect(
    page.getByRole("button", { name: "Aplicar alteração", exact: true }),
  ).toBeDisabled();
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
  await page.getByLabel("Abrir arquivo PDF").setInputFiles({
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

async function openParagraphFixture(page: Page) {
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([600, 800]);
  p.drawRectangle({
    x: 0,
    y: 0,
    width: 600,
    height: 800,
    color: rgb(0.92, 0.96, 0.91),
  });
  p.drawText(
    "Primeira linha do paragrafo original para revisar.\nSegunda linha do paragrafo original para revisar.\nTerceira linha encerra o paragrafo original.",
    { x: 50, y: 700, size: 14, lineHeight: 20 },
  );
  p.drawText("Vizinho preservado.", { x: 50, y: 580, size: 14 });
  pdf
    .addPage([600, 800])
    .drawText("Segunda pagina intacta", { x: 50, y: 700, size: 15 });
  await page.goto("/");
  await page.getByLabel("Abrir arquivo PDF").setInputFiles({
    name: "paragrafos.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(
    page.getByRole("heading", { name: "paragrafos.pdf", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Carregando página…")).not.toBeVisible();
}
test("paragraph editing reflows multiple lines with a real-font preview, export and undo", async ({
  page,
}) => {
  await openParagraphFixture(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Parágrafos", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Editar: Primeira linha/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Editar parágrafo" }),
  ).toBeVisible();
  await expect(page.getByLabel("Texto do trecho")).toHaveValue(
    /Primeira linha.*Segunda linha.*Terceira linha/,
  );
  const replacement =
    "João pode revisar um parágrafo inteiro com facilidade.\n\nOutra ideia, sem apagar o fundo da página.";
  await page.getByLabel("Texto do trecho").fill(replacement);
  await page.getByText("Ajustar espaço e entrelinhas", { exact: true }).click();
  await page.getByLabel("Altura do bloco", { exact: true }).fill("115");
  await page.getByLabel("Ajustar o tamanho ao espaço original").uncheck();
  await page.getByRole("button", { name: "Centralizar texto" }).click();
  await page.getByText("Ver prévia do bloco", { exact: true }).click();
  await expect(
    page.getByLabel("Prévia do texto editado", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aplicar alteração", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "work/paragraph-dialog-mobile.png",
    fullPage: true,
  });
  await page
    .getByLabel("Prévia do texto editado", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "work/paragraph-preview-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Aplicar alteração", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const updated = page.getByRole("button", {
    name: /^Editar: João pode revisar/,
  });
  await expect(updated).toBeVisible();
  const output = await exportPdf(page);
  expect(output.text).toContain("João pode revisar");
  expect(output.text).not.toContain("Primeira linha");
  expect(output.text).not.toContain("Segunda linha do paragrafo");
  expect(output.text).toContain("Vizinho preservado.");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Editar: Primeira linha/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(updated).toBeVisible();
  await updated.click();
  await expect(page.getByLabel("Texto do trecho")).toHaveValue(replacement);
  await expect(
    page.getByRole("button", { name: "Centralizar texto" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.reload();
  await page.getByRole("button").filter({ hasText: "paragrafos.pdf" }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: /^Editar: João pode revisar/ })
    .click();
  await expect(page.getByLabel("Texto do trecho")).toHaveValue(replacement);
});
test("precise line selection stays available and reading position survives a restart", async ({
  page,
}) => {
  await openParagraphFixture(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Trechos", exact: true }).click();
  await page
    .getByRole("button", { name: /^Editar: Segunda linha do paragrafo/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Editar trecho" }),
  ).toBeVisible();
  await page.getByLabel("Texto do trecho").fill("Linha revisada");
  await page
    .getByRole("button", { name: "Aplicar alteração", exact: true })
    .click();
  const output = await exportPdf(page);
  expect(output.text).toContain("Linha revisada");
  expect(output.text).toContain("Primeira linha");
  expect(output.text).not.toContain("Segunda linha do paragrafo");
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page.getByLabel("Número da página")).toHaveValue("2");
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo no aparelho" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button").filter({ hasText: "paragrafos.pdf" }).click();
  await expect(page.getByLabel("Número da página")).toHaveValue("2");
});
test("editing preserves reader scroll position and search counts ignore accents", async ({
  page,
}) => {
  await openParagraphFixture(page);
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Editar: Primeira linha/ }),
  ).toBeVisible();
  await page.getByTestId("reader-scroll").evaluate((el) => {
    el.scrollTop = 55;
  });
  await page.getByRole("button", { name: /^Editar: Primeira linha/ }).click();
  await page.getByLabel("Texto do trecho").fill("João revisou este parágrafo.");
  await page
    .getByRole("button", { name: "Aplicar alteração", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Salvo no aparelho" }),
  ).toBeVisible();
  expect(
    await page.getByTestId("reader-scroll").evaluate((el) => el.scrollTop),
  ).toBeGreaterThan(30);
  await page
    .getByRole("button", { name: "Pesquisar nesta página", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Pesquisar nesta página" })
    .fill("joao");
  await expect(page.getByText("1 trecho", { exact: true })).toBeVisible();
  await expect(page.locator(".search-match")).toHaveCount(1);
});

test("storage failure preserves the original and allows exporting before leaving", async ({
  page,
}) => {
  await openFixture(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "working")
        throw new DOMException("Armazenamento cheio", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar: Nome: Joao da Silva", exact: true })
    .click();
  await page.getByLabel("Texto do trecho").fill("Nome: João de Souza");
  await page
    .getByRole("button", { name: "Aplicar alteração", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "não foi salva no aparelho",
  );
  await page.getByRole("button", { name: "Voltar à biblioteca" }).click();
  await expect(
    page.getByRole("heading", { name: "meu-livro.pdf", exact: true }),
  ).toBeVisible();
  const output = await exportPdf(page);
  expect(output.text).toContain("João de Souza");
  expect(output.text).not.toContain("Joao da Silva");
  await page.getByRole("button", { name: "Voltar à biblioteca" }).click();
  await expect(
    page.getByRole("heading", { name: /Meus documentos/ }),
  ).toBeVisible();
});

test("desktop export uses the native save command and reports cancellation honestly", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__desktopSaves = [];
    (window as any).__cancelDesktopSave = false;
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === "plugin:app|version") return "0.2.1";
        if (command === "save_pdf") {
          (window as any).__desktopSaves.push(args);
          return !(window as any).__cancelDesktopSave;
        }
        throw new Error("Unexpected desktop command");
      },
    };
  });
  await openFixture(page);
  await expect(
    page.getByText(/Atualizações pelo app aguardam ativação/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar cópia", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__desktopSaves.length))
    .toBe(1);
  const saved = await page.evaluate(() => (window as any).__desktopSaves[0]);
  expect(saved.suggestedName).toBe("meu-livro_editado.pdf");
  expect(saved.bytes.slice(0, 4)).toEqual([37, 80, 68, 70]);
  await page.evaluate(() => {
    (window as any).__cancelDesktopSave = true;
  });
  await page.getByRole("button", { name: "Salvar cópia", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Salvamento cancelado");
  await expect(
    page.getByRole("heading", { name: "meu-livro.pdf", exact: true }),
  ).toBeVisible();
});
