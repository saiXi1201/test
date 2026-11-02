import { test, expect, type Page } from '@playwright/test';
import { createInitialData } from '../src/domain';

const output = (page: Page) => page.getByRole('textbox', { name: 'ポジティブの英語プロンプト', exact: true });
const tag = (page: Page, id: string) => page.locator(`[data-tag-id="${id}"]`);
const mode = (page: Page) => page.getByRole('switch', { name: '成人向け辞書', exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'イメージを、言葉に。' })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('保存済み');
});

test('adult fashion is opt-in, enables no automatic tags, and turns off cleanly', async ({ page }) => {
  await expect(mode(page)).not.toBeChecked();
  await page.getByLabel('タグを検索', { exact: true }).fill('ランジェリー');
  await expect(page.locator('.tag-option')).toHaveCount(0);
  await mode(page).click();
  await expect(output(page)).toHaveValue('');
  await expect(tag(page, 'mature-lingerie')).toBeVisible();
  await tag(page, 'mature-lingerie').click();
  await expect(output(page)).toHaveValue('lingerie');
  await page.getByLabel('タグを検索', { exact: true }).fill('スニーカー');
  await tag(page, 'sneakers').click();
  await mode(page).click();
  await expect(output(page)).toHaveValue('sneakers');
  await page.getByLabel('タグを検索', { exact: true }).fill('ランジェリー');
  await expect(page.locator('.tag-option')).toHaveCount(0);
  await expect(page.locator('.save-status')).toHaveText('保存済み');
  await page.reload();
  await expect(mode(page)).not.toBeChecked();
  await expect(output(page)).toHaveValue('sneakers');
});

test('mode changes preserve free text and hand edits byte for byte', async ({ page }) => {
  await mode(page).click();
  await tag(page, 'mature-lingerie').click();
  const free = '(custom phrase:1.2),\n  preserved text  ';
  await page.getByLabel('ポジティブの補足英語', { exact: true }).fill(free);
  await page.getByRole('button', { name: '手動編集', exact: true }).click();
  const edited = '(custom original:1.3),\n  exact spelling  ';
  await output(page).fill(edited);
  await mode(page).click();
  await expect(output(page)).toHaveValue(edited);
  await expect(page.getByLabel('ポジティブの補足英語', { exact: true })).toHaveValue(free);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '選択から再生成', exact: true }).click();
  await expect(output(page)).toHaveValue(free);
});

test('aliases, kana normalization, group filters and selected filters find expanded entries', async ({ page }) => {
  await page.getByLabel('タグを検索', { exact: true }).fill('じーじゃん');
  await expect(tag(page, 'ext-denim-jacket')).toBeVisible();
  await page.getByLabel('タグを検索', { exact: true }).fill('ＤＥＮＩＭ jacket');
  await expect(tag(page, 'ext-denim-jacket')).toBeVisible();
  await tag(page, 'ext-denim-jacket').click();
  await page.getByLabel('タグを検索', { exact: true }).fill('');
  await page.getByLabel('タグの種類で絞り込み', { exact: true }).selectOption('outerwear');
  await expect(tag(page, 'white-shirt')).toHaveCount(0);
  await expect(tag(page, 'ext-denim-jacket')).toBeVisible();
  await page.getByRole('button', { name: /選択済み/ }).click();
  await expect(page.locator('.tag-option')).toHaveCount(1);
  await expect(tag(page, 'ext-denim-jacket')).toHaveAttribute('aria-pressed', 'true');
});

test('adult-only view and dictionary keyword editing work together', async ({ page }) => {
  await mode(page).click();
  await page.getByRole('button', { name: '成人向けのみ', exact: true }).click();
  await expect(page.locator('.tag-option')).toHaveCount(20);
  await expect(page.locator('.tag-option[data-mature="false"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'すべて', exact: true }).click();
  await page.getByRole('button', { name: '辞書を編集' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'タグを追加', exact: true }).click();
  await dialog.getByLabel('日本語の表示名').fill('自分用ドレス');
  await dialog.getByLabel('出力する英語').fill('(custom dress:1.1)');
  await dialog.getByLabel('検索用の別名・キーワード').fill('お気に入り、よそいき');
  await dialog.getByRole('button', { name: '保存する', exact: true }).click();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('タグを検索', { exact: true }).fill('よそいき');
  await expect(page.locator('.tag-option')).toHaveCount(1);
  await page.locator('.tag-option').click();
  await expect(output(page)).toHaveValue('(custom dress:1.1)');
  await expect(page.locator('.save-status')).toHaveText('保存済み');
  await page.reload();
  await page.getByLabel('タグを検索', { exact: true }).fill('よそいき');
  await expect(page.locator('.tag-option')).toHaveCount(1);
});

test('legacy local data upgrades without overwriting edits, deleted originals or saved raw strings', async ({ page }) => {
  const legacy = createInitialData();
  delete legacy.catalogVersion;
  delete legacy.hiddenTagIds;
  legacy.tags = legacy.tags.filter(t => !t.id.startsWith('ext-') && !t.id.startsWith('mature-') && t.id !== 'black-shirt');
  legacy.tags.find(t => t.id === 'white-shirt')!.english = '(white shirt:1.4)';
  legacy.workspace.selectedIds = ['white-shirt'];
  legacy.saved = [{ id: 'old-raw', name: '旧版の原文', positive: '(original:1.2),\n  original text  ', negative: '', createdAt: new Date().toISOString() }];
  await page.evaluate(async value => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('iroha-studio', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('studio', 'readwrite');
      tx.objectStore('studio').put(value, 'data');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, legacy);
  await page.reload();
  await expect(output(page)).toHaveValue('(white shirt:1.4)');
  await expect(tag(page, 'black-shirt')).toHaveCount(0);
  await expect(tag(page, 'ext-denim-jacket')).toBeVisible();
  await expect(page.locator('.catalog-summary')).toContainText('470');
  await expect(page.locator('.save-status')).toHaveText('保存済み');
  await page.reload();
  await expect(page.locator('.catalog-summary')).toContainText('470');
  await page.getByRole('button', { name: '保存したプロンプト', exact: true }).click();
  await page.getByRole('button', { name: '呼び出す' }).click();
  await expect(output(page)).toHaveValue(legacy.saved[0].positive);
});

test('phone exposes adult controls, filtering and output with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(mode(page)).toBeVisible();
  await mode(page).click();
  await page.getByRole('button', { name: '成人向けのみ', exact: true }).click();
  await expect(page.locator('.tag-option')).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await tag(page, 'mature-lingerie').click();
  await page.getByRole('button', { name: /選択中.*出力を確認/ }).click();
  await expect(output(page)).toHaveValue('lingerie');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
