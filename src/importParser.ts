import type { Tag } from './domain';
import { categories } from './seed';

export interface ImportCandidate {
  id: string;
  label: string;
  english: string;
  category: string;
  group: string;
  mature: boolean;
  selected: boolean;
  note?: string;
  sourceLine: number;
}

export interface ImportOptions {
  format: 'pairs' | 'lines' | 'prompt';
  category: string;
  mature: boolean;
}

export interface ImportResult {
  candidates: ImportCandidate[];
  warnings: string[];
}

export const MAX_IMPORT_CHARACTERS = 1_000_000;
export const MAX_IMPORT_CANDIDATES = 2_000;
const japanese = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/u;
const latin = /[A-Za-z]/;
const categoryByName = new Map(categories.flatMap(category => [[category.id, category.id], [category.label, category.id]]));
const opening: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const closing = new Set(Object.values(opening));

/** Split only syntactically top-level delimiters. The original text is untouched. */
function splitTopLevel(value: string, delimiter: string): { parts: string[]; balanced: boolean } {
  const stack: string[] = [];
  const parts: string[] = [];
  let escaped = false;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (opening[char]) stack.push(opening[char]);
    else if (closing.has(char)) {
      if (stack.pop() !== char) return { parts: [value], balanced: false };
    } else if (char === delimiter && stack.length === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (stack.length || quoted) return { parts: [value], balanced: false };
  parts.push(value.slice(start));
  return { parts, balanced: true };
}

/** CSV decoding only removes CSV quoting, never commas inside the English field. */
function parseCsv(record: string): { fields: string[]; complete: boolean } {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let afterQuote = false;
  for (let index = 0; index < record.length; index++) {
    const char = record[index];
    if (inQuotes) {
      if (char === '"' && record[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { inQuotes = false; afterQuote = true; }
      else field += char;
    } else if (char === ',' ) {
      fields.push(field.trim()); field = ''; afterQuote = false;
    } else if (char === '"' && field.trim() === '' && !afterQuote) {
      field = ''; inQuotes = true;
    } else if (afterQuote && !/\s/.test(char)) {
      // Content after a closing CSV quote is ambiguous. Keep the record intact.
      return { fields: [record], complete: false };
    } else field += char;
  }
  if (inQuotes) return { fields: [record], complete: false };
  fields.push(field.trim());
  return { fields, complete: true };
}

function looksLikeCsv(value: string): boolean {
  const firstComma = value.indexOf(',');
  return firstComma >= 0 && (value.trimStart().startsWith('"') || japanese.test(value.slice(0, firstComma)) || /^(?:japanese|jp|ja|label|name)\s*,/i.test(value.trimStart()));
}

function isHeader(fields: string[]): boolean {
  if (fields.length < 2) return false;
  const label = fields[0].trim().toLowerCase();
  const english = fields[1].trim().toLowerCase();
  return ['日本語', '日本語名', '表示名', '日本語の表示名', 'jp', 'ja', 'japanese', 'label', 'name'].includes(label)
    && ['英語', '英語タグ', '英語フレーズ', 'english', 'en', 'english phrase', 'prompt'].includes(english);
}

interface PairedRow { fields?: string[]; warning?: string }
function readPair(value: string): PairedRow {
  const firstComma = value.indexOf(',');
  const explicitDelimiters = ['\t', '→', '|'].map(delimiter => value.indexOf(delimiter)).filter(index => index >= 0);
  const firstExplicit = explicitDelimiters.length ? Math.min(...explicitDelimiters) : -1;
  if (looksLikeCsv(value) && (value.trimStart().startsWith('"') || firstExplicit < 0 || firstComma < firstExplicit)) {
    const csv = parseCsv(value);
    if (!csv.complete) return { warning: 'CSVの引用符を確認してください。行全体を保持しています。' };
    return csv.fields.length >= 2 ? { fields: csv.fields } : {};
  }
  if (value.includes('\t')) return { fields: value.split('\t') };
  const arrow = value.indexOf('→');
  if (arrow >= 0) return { fields: [value.slice(0, arrow), value.slice(arrow + 1)] };
  if (value.includes('|')) {
    const parsed = splitTopLevel(value, '|');
    if (parsed.balanced && parsed.parts.length > 1) {
      const fields = parsed.parts.map(field => field.trim());
      if (fields[0] === '') fields.shift();
      if (fields.at(-1) === '') fields.pop();
      if (fields.length > 1) return { fields };
    }
  }
  return {};
}

/**
 * Candidate extraction only: no translation, phrase expansion or semantic classification.
 * The caller must review the candidates before adding any entries to their dictionary.
 */
export function parseImportText(text: string, options: ImportOptions, existingTags: readonly Tag[] = []): ImportResult {
  if (text.length > MAX_IMPORT_CHARACTERS) throw new Error('取り込みテキストは100万文字以内にしてください。資料を分けて取り込めます。');
  if (!['pairs', 'lines', 'prompt'].includes(options.format)) throw new Error('取り込み形式を選択してください。');
  if (!categoryByName.has(options.category)) throw new Error('登録先のカテゴリを選択してください。');
  const candidates: ImportCandidate[] = [];
  const warnings: string[] = [];
  const seen = new Set(existingTags.map(tag => `${tag.negative ? 'negative' : 'positive'}\0${tag.english.trim()}`));
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);

  function add(englishValue: string, labelValue: string | undefined, category: string, sourceLine: number, notes: string[] = [], forcedUnselected = false) {
    const english = englishValue.trim();
    if (!english && !labelValue?.trim()) return;
    if (candidates.length >= MAX_IMPORT_CANDIDATES) throw new Error('候補が2,000件を超えています。資料を分けて取り込んでください。');
    const label = labelValue?.trim() || english;
    let selected = !forcedUnselected;
    if (!labelValue?.trim()) notes.push('日本語名は未設定');
    if (!english || !latin.test(english) || japanese.test(english)) {
      selected = false;
      notes.push('英語欄を確認・修正してください');
    }
    if (label.length > 500 || english.length > 100_000) {
      selected = false;
      notes.push('表示名は500文字、英語は10万文字以内に修正してください');
    }
    const key = `${category === 'negative' ? 'negative' : 'positive'}\0${english}`;
    if (english && seen.has(key)) { selected = false; notes.push('同じ英語が既存辞書または候補内にあります'); }
    if (english) seen.add(key);
    candidates.push({ id: `import-${candidates.length + 1}`, label, english, category, group: 'multi:custom', mature: options.mature, selected, sourceLine, ...(notes.length ? { note: notes.join(' / ') } : {}) });
  }

  for (let index = 0; index < lines.length; index++) {
    const sourceLine = index + 1;
    let value = lines[index].trim();
    if (!value) continue;
    if (options.format === 'prompt') {
      const split = splitTopLevel(value, ',');
      if (!split.balanced) warnings.push(`${sourceLine}行目：括弧・引用符の対応が不明なため、行全体を1候補として保持しました。`);
      for (const phrase of split.parts) add(phrase, undefined, options.category, sourceLine, split.balanced ? [] : ['括弧・引用符を確認してください'], !split.balanced);
      continue;
    }
    if (options.format === 'lines') { add(value, undefined, options.category, sourceLine); continue; }

    // Quoted CSV fields may contain real line breaks. Keep them inside one record.
    if (looksLikeCsv(value)) {
      while (!parseCsv(value).complete && index + 1 < lines.length) {
        value += '\n' + lines[++index];
      }
    }
    const row = readPair(value);
    if (row.warning) warnings.push(`${sourceLine}行目：${row.warning}`);
    if (!row.fields) { add(value, undefined, options.category, sourceLine, row.warning ? [row.warning] : [], Boolean(row.warning)); continue; }
    const fields = row.fields.map(field => field.trim());
    if (isHeader(fields) || fields.every(field => /^:?-+:?$/.test(field))) continue;
    const notes: string[] = [];
    let category = options.category;
    if (fields[2]) {
      const explicitCategory = categoryByName.get(fields[2]);
      if (explicitCategory) category = explicitCategory;
      else {
        notes.push(`分類「${fields[2]}」は未認識のため登録先カテゴリを使用`);
        warnings.push(`${sourceLine}行目：分類「${fields[2]}」を認識できませんでした。`);
      }
    }
    if (fields.length > 3) {
      notes.push('列数を確認してください。余分な列を英語欄に保持しています');
      warnings.push(`${sourceLine}行目：4列以上あるため、登録前の確認が必要です。`);
      add(fields.slice(1).join('\t'), fields[0], options.category, sourceLine, notes, true);
    } else add(fields[1] ?? '', fields[0], category, sourceLine, notes);
  }
  return { candidates, warnings };
}
