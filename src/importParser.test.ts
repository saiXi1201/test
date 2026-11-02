import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImportText, type ImportOptions } from './importParser';
import type { Tag } from './domain';

const defaults: ImportOptions = { format: 'pairs', category: 'outfit', mature: false };

test('paired tab, pipe, arrow and explicit categories preserve complete English phrases', () => {
  const { candidates } = parseImportText('日本語\t英語\tカテゴリ\n白いシャツ\t(white shirt:1.2), black ribbon\toutfit\n上半身 | upper body | 構図・カメラ\nこちらを見る → looking at viewer', defaults);
  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].english, '(white shirt:1.2), black ribbon');
  assert.equal(candidates[0].sourceLine, 2);
  assert.equal(candidates[1].category, 'composition');
  assert.equal(candidates[2].english, 'looking at viewer');
  assert.ok(candidates.every(candidate => candidate.selected));
});

test('quoted CSV decodes quoting without splitting inner commas or whitespace', () => {
  const { candidates } = parseImportText('"表示名","英語"\n"衣装","(white shirt, black skirt:1.2),  ribbon"\n"メモ付き","custom ""quote"" phrase"', defaults);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].english, '(white shirt, black skirt:1.2),  ribbon');
  assert.equal(candidates[1].english, 'custom "quote" phrase');
});

test('CSV delimiters inside quoted English are not mistaken for paired row delimiters', () => {
  const { candidates } = parseImportText('jp,en\n"衣装","turn → viewer, {red|blue}"\n衣装 → white shirt, black skirt\n"quoted, phrase"', defaults);
  assert.equal(candidates.length, 3);
  assert.equal(candidates[0].english, 'turn → viewer, {red|blue}');
  assert.equal(candidates[1].english, 'white shirt, black skirt');
  assert.equal(candidates[2].english, '"quoted, phrase"');
});

test('multiline CSV keeps English inside the quoted field and tracks source lines', () => {
  const { candidates } = parseImportText('衣装,"white shirt,\n  black skirt"\n視線,looking at viewer', defaults);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].english, 'white shirt,\n  black skirt');
  assert.equal(candidates[0].sourceLine, 1);
  assert.equal(candidates[1].sourceLine, 3);
});

test('English-only lines stay whole and Japanese prose requires review without translation', () => {
  const { candidates } = parseImportText('white shirt, black skirt\n日本語だけの説明文\n白い衣装\twhite shirt', defaults);
  assert.equal(candidates[0].english, 'white shirt, black skirt');
  assert.equal(candidates[0].label, 'white shirt, black skirt');
  assert.equal(candidates[0].note, '日本語名は未設定');
  assert.equal(candidates[0].selected, true);
  assert.equal(candidates[1].selected, false);
  assert.equal(candidates[1].english, '日本語だけの説明文');
  assert.equal(candidates[2].label, '白い衣装');
});

test('lines mode never parses delimiters or weighted phrase commas', () => {
  const { candidates } = parseImportText('shirt → white shirt\n(white shirt, black skirt:1.2)', { ...defaults, format: 'lines' });
  assert.equal(candidates[0].english, 'shirt → white shirt');
  assert.equal(candidates[1].english, '(white shirt, black skirt:1.2)');
});

test('prompt mode splits top-level commas only, including escaped commas and brackets', () => {
  const text = '(masterpiece, best quality), [soft light, sunset], {red|blue}, <lora:test:0.5>, AZKi \\(hololive\\), phrase\\, continued, "quoted, phrase"';
  const { candidates, warnings } = parseImportText(text, { ...defaults, format: 'prompt' });
  assert.deepEqual(candidates.map(candidate => candidate.english), ['(masterpiece, best quality)', '[soft light, sunset]', '{red|blue}', '<lora:test:0.5>', 'AZKi \\(hololive\\)', 'phrase\\, continued', '"quoted, phrase"']);
  assert.equal(warnings.length, 0);
});

test('malformed bracket syntax retains the whole line unselected instead of partial splitting', () => {
  const text = 'white shirt, (black skirt, ribbon]';
  const { candidates, warnings } = parseImportText(text, { ...defaults, format: 'prompt' });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].english, text);
  assert.equal(candidates[0].selected, false);
  assert.equal(warnings.length, 1);
});

test('duplicates use exact English and positive/negative polarity without syntax normalization', () => {
  const existing: Tag[] = [{ id: 'white', label: '白', english: 'white shirt', category: 'outfit', group: 'tops' }];
  const { candidates } = parseImportText('白\twhite shirt\n重み\t(white shirt:1.2)\n別\twhite shirt\n除外\twhite shirt\tnegative\n大文字\tWhite Shirt', defaults, existing);
  assert.deepEqual(candidates.map(candidate => candidate.selected), [false, true, false, true, true]);
});

test('markdown headers, empty rows and rule separators are skipped', () => {
  const { candidates } = parseImportText('\uFEFF| 日本語 | 英語 |\n| --- | --- |\n\n| 上半身 | upper body |', defaults);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].english, 'upper body');
});

test('unknown category is visible in warnings and does not infer another category', () => {
  const { candidates, warnings } = parseImportText('衣装\twhite shirt\tunknown', defaults);
  assert.equal(candidates[0].category, 'outfit');
  assert.equal(warnings.length, 1);
});

test('mature setting is a classification only and never changes source phrases', () => {
  const { candidates } = parseImportText('大人向け衣装\tadult fashion', { ...defaults, mature: true });
  assert.equal(candidates[0].mature, true);
  assert.equal(candidates[0].english, 'adult fashion');
  assert.equal(candidates[0].group, 'multi:custom');
});

test('limits fail with actionable errors rather than silently truncating text or rows', () => {
  assert.throws(() => parseImportText('a'.repeat(1_000_001), defaults), /100万文字/);
  assert.throws(() => parseImportText(Array.from({ length: 2001 }, (_, i) => `phrase ${i}`).join('\n'), defaults), /2,000件/);
  assert.equal(parseImportText(Array.from({ length: 2000 }, (_, i) => `phrase ${i}`).join('\n'), defaults).candidates.length, 2000);
});
