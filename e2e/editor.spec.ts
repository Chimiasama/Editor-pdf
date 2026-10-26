import { test, expect, type Page, type Download } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
async function openFixture(page: Page) {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]).drawText('Original editable document', { x: 50, y: 700, size: 18 });
  pdf.addPage([600, 800]).drawText('Second page content', { x: 50, y: 700, size: 18 });
  await page.goto('/');
  await page.getByLabel('Abrir arquivo PDF').setInputFiles({ name: 'mobile-test.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.getByRole('heading', { name: 'mobile-test.pdf' })).toBeVisible();
  await expect(page.getByText('Carregando página…')).not.toBeVisible();
  await expect(page.locator('canvas').first()).toHaveJSProperty('width', 358);
}
async function extractDownload(page: Page, download: Download) {
  const path = await download.path();
  const bytes = [...await readFile(path!)];
  const pdf = await PDFDocument.load(new Uint8Array(bytes));
  const text = await page.evaluate(async data => {
    const { loadPdfJsDocument } = await import('/src/utils/pdfEngine.ts' as string);
    const document = await loadPdfJsDocument(new Uint8Array(data));
    const parts: string[] = [];
    for (let n = 1; n <= document.numPages; n++) {
      const content = await (await document.getPage(n)).getTextContent();
      parts.push(content.items.map((i: any) => i.str || '').join(' '));
    }
    await document.loadingTask.destroy();
    return parts.join('\n');
  }, bytes);
  return { pdf, text };
}
test('mobile import, edit, undo, restart and export retain real PDF bytes', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: '+ Texto', exact: true }).click();
  const box = await page.locator('canvas').first().boundingBox();
  await page.touchscreen.tap(box!.x + 35, box!.y + 120);
  await page.getByLabel('Texto do bloco').fill('Edição persistente');
  await page.getByRole('button', { name: 'Aplicar texto' }).click();
  await expect(page.locator('[data-annotation]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.locator('[data-annotation]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  await expect(page.locator('[data-annotation]')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: 'Salvo no aparelho' })).toBeVisible();
  await page.reload();
  await page.getByRole('button').filter({ hasText: 'mobile-test.pdf' }).click();
  await expect(page.locator('[data-annotation]')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const result = await extractDownload(page, await download);
  expect(result.pdf.getPageCount()).toBe(2);
  expect(result.text).toContain('Edição persistente');
  expect(result.text).toContain('Original editable document');
});
test('existing text opens a populated correction editor; document mode flows and persists text', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: 'Corrigir texto', exact: true }).click();
  await page.getByRole('button', { name: 'Corrigir: Original editable document' }).click();
  await expect(page.getByLabel('Texto do bloco')).toHaveValue('Original editable document');
  await page.getByLabel('Texto do bloco').fill('Trecho corrigido');
  await page.getByRole('button', { name: 'Aplicar texto', exact: true }).click();
  const correctionDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const correction = await extractDownload(page, await correctionDownload);
  expect(correction.text).toContain('Trecho corrigido');
  expect(correction.text).toContain('Original editable document'); // visual correction must never be described as secure redaction
  await page.getByRole('button', { name: 'Modo Documento', exact: true }).click();
  await page.getByRole('button', { name: 'Converter texto do PDF' }).click();
  const editor = page.getByRole('textbox', { name: 'Conteúdo do documento' });
  await expect(editor).toContainText('Original editable document');
  await editor.fill(('Texto revisado com ação e coração.\n').repeat(100));
  await expect(page.getByRole('status')).toHaveText('Salvo no aparelho');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PDF', exact: true }).click();
  const result = await extractDownload(page, await download);
  expect(result.pdf.getPageCount()).toBeGreaterThan(1);
  expect(result.text).toContain('Texto revisado com ação e coração.');
  expect(result.text).not.toContain('Original editable document');
  await page.reload();
  await page.getByRole('button').filter({ hasText: 'mobile-test.pdf' }).click();
  await page.getByRole('button', { name: 'Modo Documento', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Conteúdo do documento' })).toContainText('Texto revisado com ação e coração.');
});
test('two-finger pinch zooms in reading mode without creating edits', async ({ page }) => {
  await openFixture(page);
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 300 }, { x: 220, y: 300 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 300 }, { x: 260, y: 300 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('canvas').first()).not.toHaveJSProperty('width', 358);
  await expect(page.locator('[data-annotation]')).toHaveCount(0);
});

test('touch drag and resize commit one undo step without triggering reading zoom', async ({ page }) => {
  await openFixture(page);
  await page.getByRole('button', { name: '+ Texto', exact: true }).click();
  const canvas = await page.locator('canvas').first().boundingBox();
  await page.touchscreen.tap(canvas!.x + 30, canvas!.y + 150);
  await page.getByLabel('Texto do bloco').fill('Move this');
  await page.getByRole('button', { name: 'Aplicar texto' }).click();
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  const annotation = page.locator('[data-annotation]').first();
  const before = await annotation.boundingBox();
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: before!.x + 20, y: before!.y + 10 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: before!.x + 55, y: before!.y + 40 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await annotation.boundingBox())!.x).toBeGreaterThan(before!.x + 20);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect.poll(async () => Math.abs((await annotation.boundingBox())!.x - before!.x)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.locator('[data-annotation]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  await annotation.tap();
  const handle = page.getByRole('button', { name: 'Redimensionar anotação' });
  const h = await handle.boundingBox();
  const oldWidth = (await annotation.boundingBox())!.width;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: h!.x + 16, y: h!.y + 16 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: h!.x + 46, y: h!.y + 36 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await annotation.boundingBox())!.width).toBeGreaterThan(oldWidth + 15);
});
