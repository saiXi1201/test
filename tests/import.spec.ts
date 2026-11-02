import { test, expect, type Page } from '@playwright/test';
import JSZip from 'jszip';

const output = (page: Page) => page.getByRole('textbox', { name: 'ポジティブの英語プロンプト', exact: true });
const openImport = async (page: Page) => {
  await page.getByRole('button', { name: '資料から一括登録', exact: true }).click();
  return page.getByRole('dialog', { name: '資料から辞書へ一括登録', exact: true });
};

async function wordTableFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>日本語</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>英語</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>星灯りの旅行コート</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>starlight travel coat</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>銀のコンパス</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>tiny silver compass</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

function pdfFixture(lines: string[]): Buffer {
  const escape = (line: string) => line.replace(/([\\()])/g, '\\$1');
  const stream = lines.length ? `BT /F1 12 Tf 72 720 Td ${lines.map((line, i) => `${i ? '0 -24 Td ' : ''}(${escape(line)}) Tj`).join('\n')} ET` : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'イメージを、言葉に。' })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('保存済み');
});

test('TSV preview edits candidates, skips existing duplicates and imports without selecting tags', async ({ page }) => {
  const dialog = await openImport(page);
  await dialog.getByLabel('取り込み用テキスト', { exact: true }).fill('独自の衣装\tcustom linen outfit\nunique studio phrase\n白いシャツ\twhite shirt');
  await dialog.getByRole('button', { name: '登録候補を確認', exact: true }).click();
  await expect(dialog.getByLabel('候補1の英語', { exact: true })).toHaveValue('custom linen outfit');
  await expect(dialog.getByLabel('候補2の表示名', { exact: true })).toHaveValue('unique studio phrase');
  await expect(dialog.getByLabel('候補3を登録', { exact: true })).toBeDisabled();
  await dialog.getByLabel('候補1の表示名', { exact: true }).fill('登録用の衣装');
  await dialog.getByLabel('候補1の英語', { exact: true }).fill('(custom linen outfit:1.2), ribbon');
  await dialog.getByLabel('候補2の表示名', { exact: true }).fill('スタジオのフレーズ');
  await dialog.getByRole('button', { name: '2件を一括登録', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(output(page)).toHaveValue('');
  await page.getByLabel('タグを検索', { exact: true }).fill('登録用の衣装');
  await expect(page.locator('.tag-option')).toHaveCount(1);
  await expect(page.locator('.tag-option')).toContainText('(custom linen outfit:1.2), ribbon');
  await expect(page.locator('.save-status')).toHaveText('保存済み');
  await page.reload();
  await page.getByLabel('タグを検索', { exact: true }).fill('スタジオのフレーズ');
  await expect(page.locator('.tag-option')).toHaveCount(1);
});

test('explicit prompt splitting preserves weighted groups and escaped parentheses with duplicate skips', async ({ page }) => {
  const dialog = await openImport(page);
  await dialog.getByLabel('資料の読み取り方', { exact: true }).selectOption('prompt');
  await dialog.getByLabel('取り込み用テキスト', { exact: true }).fill('(studio light, warm palette:1.2), original \\(series\\), white shirt, original \\(series\\)');
  await dialog.getByRole('button', { name: '登録候補を確認', exact: true }).click();
  await expect(dialog.getByLabel('候補1の英語', { exact: true })).toHaveValue('(studio light, warm palette:1.2)');
  await expect(dialog.getByLabel('候補2の英語', { exact: true })).toHaveValue('original \\(series\\)');
  await expect(dialog.getByLabel('候補3を登録', { exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('候補4を登録', { exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '2件を一括登録', exact: true }).click();
  await expect(output(page)).toHaveValue('');
  await page.getByLabel('タグを検索', { exact: true }).fill('original');
  await expect(page.locator('.tag-option')).toHaveCount(1);
});

test('CSV upload preserves current source on unsupported DOC error and guards unsaved Escape', async ({ page }) => {
  const dialog = await openImport(page);
  const source = '日本語,英語\n"水色の旅行服","(blue travel outfit:1.2), silver pin"';
  await dialog.locator('input[type=file]').setInputFiles({ name: 'glossary.csv', mimeType: 'text/csv', buffer: Buffer.from(source) });
  await expect(dialog.getByLabel('取り込み用テキスト', { exact: true })).toHaveValue(source);
  page.once('dialog', confirmation => confirmation.accept());
  await dialog.locator('input[type=file]').setInputFiles({ name: 'legacy.doc', mimeType: 'application/msword', buffer: Buffer.from('old document') });
  await expect(dialog.getByRole('alert')).toContainText('旧形式の.doc');
  await expect(dialog.getByLabel('取り込み用テキスト', { exact: true })).toHaveValue(source);
  page.once('dialog', confirmation => confirmation.dismiss());
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '登録候補を確認', exact: true }).click();
  await expect(dialog.getByLabel('候補1の英語', { exact: true })).toHaveValue('(blue travel outfit:1.2), silver pin');
  page.once('dialog', confirmation => confirmation.accept());
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(output(page)).toHaveValue('');
});

test('adult import classification enables dictionary visibility without auto-selecting phrases', async ({ page }) => {
  const dialog = await openImport(page);
  await dialog.getByLabel('取り込み用テキスト', { exact: true }).fill('成人のイブニング衣装\tcustom adult evening outfit');
  await dialog.getByLabel('取り込みの表示区分', { exact: true }).selectOption('adult');
  await dialog.getByRole('button', { name: '登録候補を確認', exact: true }).click();
  await dialog.getByRole('button', { name: '1件を一括登録', exact: true }).click();
  await expect(page.getByRole('switch', { name: '成人向け辞書', exact: true })).toBeChecked();
  await expect(output(page)).toHaveValue('');
  await page.getByLabel('タグを検索', { exact: true }).fill('custom adult evening');
  await expect(page.locator('.tag-option')).toHaveCount(1);
  await expect(page.locator('.tag-option')).toHaveAttribute('data-mature', 'true');
  await page.getByRole('switch', { name: '成人向け辞書', exact: true }).click();
  await expect(page.locator('.tag-option')).toHaveCount(0);
});

test('actual DOCX table extracts tab-separated bilingual rows into registration candidates', async ({ page }) => {
  const dialog = await openImport(page);
  await dialog.locator('input[type=file]').setInputFiles({ name: 'glossary.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await wordTableFixture() });
  await expect(dialog.getByLabel('取り込み用テキスト', { exact: true })).toHaveValue('日本語\t英語\n星灯りの旅行コート\tstarlight travel coat\n銀のコンパス\ttiny silver compass');
  await dialog.getByRole('button', { name: '登録候補を確認', exact: true }).click();
  await expect(dialog.getByLabel('候補1の表示名', { exact: true })).toHaveValue('星灯りの旅行コート');
  await expect(dialog.getByLabel('候補1の英語', { exact: true })).toHaveValue('starlight travel coat');
  await expect(dialog.getByLabel('候補2の英語', { exact: true })).toHaveValue('tiny silver compass');
  await dialog.getByRole('button', { name: '2件を一括登録', exact: true }).click();
  await page.getByLabel('タグを検索', { exact: true }).fill('星灯り');
  await expect(page.locator('.tag-option')).toHaveCount(1);
});

test('actual text PDF extracts English rows and generates separate candidates', async ({ page }) => {
  const dialog = await openImport(page);
  await dialog.locator('input[type=file]').setInputFiles({ name: 'phrases.pdf', mimeType: 'application/pdf', buffer: pdfFixture(['violet travel coat', 'tiny silver compass']) });
  await expect(dialog.getByLabel('取り込み用テキスト', { exact: true })).toHaveValue('violet travel coat\ntiny silver compass');
  await dialog.getByRole('button', { name: '登録候補を確認', exact: true }).click();
  await expect(dialog.getByLabel('候補1の英語', { exact: true })).toHaveValue('violet travel coat');
  await expect(dialog.getByLabel('候補2の英語', { exact: true })).toHaveValue('tiny silver compass');
  await expect(dialog.getByRole('button', { name: '2件を一括登録', exact: true })).toBeEnabled();
});

test('textless PDF reports OCR requirement and does not invent source content', async ({ page }) => {
  const dialog = await openImport(page);
  await dialog.locator('input[type=file]').setInputFiles({ name: 'textless.pdf', mimeType: 'application/pdf', buffer: pdfFixture([]) });
  await expect(dialog.getByRole('alert')).toContainText('OCRが必要');
  await expect(dialog.getByLabel('取り込み用テキスト', { exact: true })).toHaveValue('');
  await expect(dialog.getByRole('button', { name: '登録候補を確認', exact: true })).toBeDisabled();
});
