import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const positiveOutput = (page: Page) => page.getByRole('textbox', { name: 'ポジティブの英語プロンプト', exact: true });
const tag = (page: Page, label: string) => page.locator('.tag-option').filter({ has: page.getByText(label, { exact: true }) });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'イメージを、言葉に。' })).toBeVisible();
  await expect(page.locator('.save-status')).toHaveText('保存済み');
});

test('empty start, exclusive clothing selection, and copied English', async ({ page, context }) => {
  await expect(positiveOutput(page)).toHaveValue('');
  await expect(page.getByRole('switch', { name: '品質タグセット' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'プロンプトをコピー', exact: true })).toBeDisabled();
  await tag(page, '白いシャツ').click();
  await expect(positiveOutput(page)).toHaveValue('white shirt');
  await tag(page, '黒いシャツ').click();
  await expect(positiveOutput(page)).toHaveValue('black shirt');
  await expect(tag(page, '白いシャツ')).toHaveAttribute('aria-pressed', 'false');
  await tag(page, '黒いスカート').click();
  await expect(positiveOutput(page)).toHaveValue('black shirt, black skirt');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'プロンプトをコピー', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('black shirt, black skirt');
  await page.screenshot({ path: '/tmp/iroha-tested-desktop.png', fullPage: true });
});

test('character hair replacement preserves other appearance and outfit preserves shoes', async ({ page }) => {
  await page.getByLabel('すべてのキャラクターから選択').selectOption('azki');
  await expect(positiveOutput(page)).toHaveValue(/long hair, black hair, pink eyes/);
  await page.getByLabel('髪型差分', { exact: true }).selectOption('azki-ponytail');
  await expect(positiveOutput(page)).toHaveValue(/ponytail, black hair, pink eyes/);
  await expect(positiveOutput(page)).not.toHaveValue(/long hair/);
  await tag(page, 'スニーカー').click();
  await tag(page, '黒いシャツ').click();
  await page.getByLabel('衣装差分', { exact: true }).selectOption('azki-casual');
  await expect(positiveOutput(page)).toHaveValue(/white shirt, black skirt/);
  await expect(positiveOutput(page)).toHaveValue(/sneakers/);
  await expect(positiveOutput(page)).not.toHaveValue(/black shirt/);
  await page.getByRole('button', { name: 'AZKi・髪色を解除', exact: true }).click();
  await expect(positiveOutput(page)).not.toHaveValue(/black hair/);
  await expect(positiveOutput(page)).toHaveValue(/pink eyes/);
});

test('manual edit survives new selections and negative stays separate', async ({ page }) => {
  await tag(page, '白いシャツ').click();
  await page.getByRole('button', { name: '手動編集', exact: true }).click();
  const handwritten = '(white shirt:1.2), original \\(character\\)\n  custom phrase';
  await positiveOutput(page).fill(handwritten);
  await tag(page, '黒いスカート').click();
  await expect(positiveOutput(page)).toHaveValue(handwritten);
  await expect(page.getByText('手動編集版を保持中。選択変更は上書きしません。')).toBeVisible();
  await page.getByLabel('タグを検索', { exact: true }).fill('手の崩れ');
  await tag(page, '手の崩れ').click();
  await page.locator('.output-tabs').getByRole('button', { name: /ネガティブ/ }).click();
  await expect(page.getByRole('textbox', { name: 'ネガティブの英語プロンプト', exact: true })).toHaveValue('bad hands');
  await page.locator('.output-tabs').getByRole('button', { name: /ポジティブ/ }).click();
  await expect(positiveOutput(page)).toHaveValue(handwritten);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '選択から再生成', exact: true }).click();
  await expect(positiveOutput(page)).toHaveValue('white shirt, black skirt');
});

test('saved combinations return to automatic generation when dictionary is unchanged', async ({ page }) => {
  await tag(page, '白いシャツ').click();
  await tag(page, '黒いスカート').click();
  await page.getByRole('button', { name: '組み合わせを保存', exact: true }).click();
  await page.getByRole('dialog').getByLabel('保存名', { exact: true }).fill('いつもの服装');
  await page.getByRole('dialog').getByRole('button', { name: '保存する', exact: true }).click();
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(positiveOutput(page)).toHaveValue('');
  await page.getByRole('button', { name: '保存したプロンプト', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '呼び出す' }).click();
  await expect(positiveOutput(page)).toHaveValue('white shirt, black skirt');
  await expect(positiveOutput(page)).toHaveAttribute('readonly', '');
  await tag(page, '黒いシャツ').click();
  await expect(positiveOutput(page)).toHaveValue('black shirt, black skirt');
});

test('raw library preserves punctuation and whitespace through load and reload', async ({ page }) => {
  const raw = '(masterpiece, best quality),\nAZKi \\(hololive\\),,  custom phrase  ';
  const negative = '(blurry:1.2)\n  unwanted details';
  await page.getByRole('button', { name: '成功したプロンプトを原文で登録' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('保存名', { exact: true }).fill('原文保持テスト');
  await dialog.getByLabel('ポジティブ', { exact: true }).fill(raw);
  await dialog.getByLabel('ネガティブ（任意）', { exact: true }).fill(negative);
  await dialog.getByRole('button', { name: '保存する', exact: true }).click();
  await page.getByRole('button', { name: '保存したプロンプト', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '呼び出す' }).click();
  await expect(positiveOutput(page)).toHaveValue(raw);
  await expect(page.locator('.save-status')).toHaveText('保存済み');
  await page.reload();
  await expect(positiveOutput(page)).toHaveValue(raw);
  await page.locator('.output-tabs').getByRole('button', { name: /ネガティブ/ }).click();
  await expect(page.getByRole('textbox', { name: 'ネガティブの英語プロンプト', exact: true })).toHaveValue(negative);
  await page.getByRole('button', { name: '保存したプロンプト', exact: true }).click();
  await expect(page.getByRole('heading', { name: '原文保持テスト', exact: true })).toBeVisible();
});

test('character CRUD, dirty Escape guard, and selection of a newly added character', async ({ page }) => {
  await page.getByRole('button', { name: '管理する' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'キャラクターを追加' }).click();
  await dialog.getByLabel('日本語の表示名').fill('テストキャラクター');
  await dialog.getByLabel('作品・所属', { exact: true }).fill('オリジナル');
  await dialog.getByLabel('キャラクター名の英語タグ', { exact: true }).fill('original character');
  await dialog.getByLabel('髪型（英語）', { exact: true }).fill('short hair');
  page.once('dialog', confirmation => confirmation.dismiss());
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('日本語の表示名')).toHaveValue('テストキャラクター');
  await dialog.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('保存しました');
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('すべてのキャラクターから選択').selectOption({ label: 'テストキャラクター — オリジナル' });
  await expect(positiveOutput(page)).toHaveValue('original character, short hair');
  await page.getByRole('button', { name: '管理する' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '名前・所属で検索' }).fill('テストキャラクター');
  await dialog.locator('.manager-item').click();
  await dialog.getByLabel('日本語の表示名').fill('編集後キャラクター');
  await dialog.getByRole('button', { name: '保存する', exact: true }).click();
  await dialog.getByRole('textbox', { name: '名前・所属で検索' }).fill('編集後キャラクター');
  await expect(dialog.locator('.manager-item')).toContainText('編集後キャラクター');
  page.once('dialog', confirmation => confirmation.accept());
  await dialog.getByRole('button', { name: 'キャラクターを削除', exact: true }).click();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(positiveOutput(page)).toHaveValue('');
});

test('dictionary CRUD immediately affects generated selections', async ({ page }) => {
  await page.getByRole('button', { name: '辞書を編集' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'タグを追加', exact: true }).click();
  await dialog.getByLabel('日本語の表示名').fill('テストの衣装');
  await dialog.getByLabel('出力する英語').fill('(custom outfit:1.2)');
  await dialog.getByRole('button', { name: '保存する', exact: true }).click();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByLabel('タグを検索', { exact: true }).fill('テストの衣装');
  await tag(page, 'テストの衣装').click();
  await expect(positiveOutput(page)).toHaveValue('(custom outfit:1.2)');
  await page.getByRole('button', { name: '辞書を編集' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: '日本語・英語で検索' }).fill('テストの衣装');
  await dialog.locator('.manager-item').click();
  await dialog.getByLabel('出力する英語').fill('(custom outfit:1.3)');
  await dialog.getByRole('button', { name: '保存する', exact: true }).click();
  page.once('dialog', confirmation => confirmation.accept());
  await dialog.getByRole('button', { name: '削除', exact: true }).click();
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(positiveOutput(page)).toHaveValue('');
  await expect(tag(page, 'テストの衣装')).toHaveCount(0);
});

test('backup export, invalid-file protection, restoration, and persisted result', async ({ page }) => {
  await tag(page, '白いシャツ').click();
  await page.getByRole('switch', { name: '品質タグセット' }).click();
  const original = await positiveOutput(page).inputValue();
  await page.getByRole('button', { name: '保存と設定', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSONを書き出す', exact: true }).click();
  const download = await downloadEvent;
  const backup = await readFile((await download.path())!);
  expect(JSON.parse(backup.toString()).workspace.selectedIds).toContain('white-shirt');
  await page.getByRole('dialog').getByRole('button', { name: '閉じる', exact: true }).click();
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await page.getByRole('button', { name: '保存と設定', exact: true }).click();
  const input = page.getByRole('dialog').locator('input[type=file]');
  await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":999}') });
  await expect(page.getByRole('alert')).toContainText('バックアップの形式が正しくない');
  await expect(page.getByRole('button', { name: '復元を実行', exact: true })).toHaveCount(0);
  await input.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByRole('button', { name: '復元を実行', exact: true })).toBeVisible();
  await input.setInputFiles({ name: 'invalid-after-valid.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":999}') });
  await expect(page.getByRole('alert')).toContainText('バックアップの形式が正しくない');
  await expect(page.getByRole('button', { name: '復元を実行', exact: true })).toHaveCount(0);
  await input.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: backup });
  await page.getByRole('button', { name: '復元を実行', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('バックアップを復元しました');
  await page.getByRole('dialog').getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(positiveOutput(page)).toHaveValue(original);
  await page.reload();
  await expect(positiveOutput(page)).toHaveValue(original);
});

test('mobile selection and output work without document horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'イメージを、言葉に。' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await tag(page, '白いシャツ').click();
  await page.getByRole('button', { name: /選択中.*出力を確認/ }).click();
  await expect(positiveOutput(page)).toBeVisible();
  await expect(positiveOutput(page)).toHaveValue('white shirt');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/iroha-tested-mobile-output.png', fullPage: true });
  await page.getByRole('button', { name: '選択に戻る', exact: true }).click();
  await expect(tag(page, '白いシャツ')).toBeVisible();
  await page.screenshot({ path: '/tmp/iroha-tested-mobile.png', fullPage: true });
});
