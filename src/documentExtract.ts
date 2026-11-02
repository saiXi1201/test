import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import InlinePdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { extractRawText } from 'mammoth/mammoth.browser';
import JSZip from 'jszip';

export interface ExtractedDocument {
  text: string;
  warnings: string[];
  kind: 'pdf' | 'docx' | 'text';
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 1_000_000;
const MAX_PDF_PAGES = 200;

function checkTextSize(text: string): string {
  if (text.length > MAX_TEXT_LENGTH) throw new Error('抽出テキストが100万文字を超えています。資料を分割して取り込んでください。');
  return text;
}

interface PdfItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
}

interface PositionedItem { text: string; x: number; y: number; width: number; height: number; eol: boolean; order: number }

/** Reconstruct horizontal text rows and preserve large table-column gaps as tabs. */
function extractPdfRows(items: unknown[], viewport: { transform: number[] }): string {
  const transform = viewport.transform;
  const positioned: PositionedItem[] = [];
  items.forEach((item, order) => {
    if (!item || typeof item !== 'object' || !('str' in item)) return;
    const text = item as PdfItem;
    // PDF.js may represent a whole inter-column gap as one wide " " item.
    // Reconstruct its spacing from the next real glyph's position instead.
    if (!text.str.trim()) return;
    const x = text.transform[4];
    const y = text.transform[5];
    positioned.push({ text: text.str, x: transform[0] * x + transform[2] * y + transform[4], y: transform[1] * x + transform[3] * y + transform[5], width: Math.abs(text.width), height: Math.max(Math.abs(text.height), 1), eol: text.hasEOL, order });
  });
  positioned.sort((a, b) => a.y - b.y || a.order - b.order);
  const rows: { y: number; height: number; items: PositionedItem[] }[] = [];
  for (const item of positioned) {
    const last = rows.at(-1);
    const tolerance = Math.max(2, Math.min(item.height, last?.height ?? item.height) * 0.35);
    if (last && Math.abs(last.y - item.y) <= tolerance) last.items.push(item);
    else rows.push({ y: item.y, height: item.height, items: [item] });
  }
  return rows.map(row => {
    row.items.sort((a, b) => a.x - b.x || a.order - b.order);
    let line = '';
    let previous: PositionedItem | undefined;
    for (const item of row.items) {
      if (previous) {
        const gap = item.x - (previous.x + previous.width);
        const columnGap = Math.max(18, Math.min(previous.height, item.height) * 1.5);
        if (gap > columnGap) line += '\t';
        else if ((gap > Math.max(1, item.height * 0.12) || previous.eol) && !/\s$/.test(line) && !/^\s/.test(item.text)) line += ' ';
      }
      line += item.text;
      previous = item;
    }
    return line.trim();
  }).filter(Boolean).join('\n');
}

function isPdfSignature(bytes: Uint8Array): boolean {
  return new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(bytes.length, 1024))).includes('%PDF-');
}

function isZipSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

async function readPdf(buffer: ArrayBuffer): Promise<ExtractedDocument> {
  if (!isPdfSignature(new Uint8Array(buffer))) throw new Error('PDFの形式を確認できません。元のPDFファイルを選択してください。');
  const worker = new InlinePdfWorker();
  GlobalWorkerOptions.workerPort = worker;
  let task: ReturnType<typeof getDocument> | undefined;
  const warnings: string[] = ['PDFの段組み・表・改行は完全には復元できない場合があります。抽出内容と登録候補を確認してください。'];
  try {
    task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true });
    const document = await task.promise;
    if (document.numPages > MAX_PDF_PAGES) throw new Error('PDFは200ページ以内で取り込めます。必要なページを分けて保存してください。');
    const pages: string[] = [];
    let length = 0;
    let emptyPages = 0;
    let rotated = false;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      rotated ||= page.rotate % 180 !== 0;
      const content = await page.getTextContent();
      const text = extractPdfRows(content.items, page.getViewport({ scale: 1 }));
      if (!text.trim()) emptyPages++;
      length += text.length + 2;
      if (length > MAX_TEXT_LENGTH) throw new Error('抽出テキストが100万文字を超えています。資料を分割して取り込んでください。');
      pages.push(text);
      page.cleanup();
    }
    const text = pages.join('\n\n');
    if (!text.trim()) throw new Error('PDFから文字を抽出できませんでした。画像だけのPDFにはOCRが必要です。文字認識済みのPDFか、テキスト・Word文書をご用意ください。');
    if (emptyPages) warnings.push(`${emptyPages}ページは文字を抽出できませんでした。画像のページは取り込み対象に含まれていません。`);
    if (rotated) warnings.push('回転したページが含まれています。単語の順序や対応関係を特に確認してください。');
    return { text, warnings, kind: 'pdf' };
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('パスワード付きPDFには対応していません。ご自身で開ける保護解除済みのコピーを選択してください。');
    if (error instanceof Error && ['InvalidPDFException', 'MissingPDFException', 'UnexpectedResponseException'].includes(error.name)) throw new Error('PDFを読み込めませんでした。ファイルが壊れていないか確認してください。');
    throw error;
  } finally {
    await task?.destroy().catch(() => undefined);
    if (GlobalWorkerOptions.workerPort === worker) GlobalWorkerOptions.workerPort = null;
    worker.terminate();
  }
}

function wordText(element: Element): string {
  if (['del', 'delText', 'moveFrom'].includes(element.localName)) return '';
  if (element.localName === 't') return element.textContent ?? '';
  if (element.localName === 'tab') return '\t';
  if (element.localName === 'br' || element.localName === 'cr') return '\n';
  return [...element.children].map(wordText).join('');
}

/** Read Word table cells as text only. XML is never inserted into the page. */
async function readWordTables(buffer: ArrayBuffer): Promise<string | null> {
  const archive = await JSZip.loadAsync(buffer);
  const documentEntry = archive.file('word/document.xml');
  if (!documentEntry) throw new Error('Word本文がありません。');
  const xml = await documentEntry.async('string');
  if (xml.length > 8_000_000) throw new Error('Word本文が大きすぎます。必要な部分を分割してください。');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('このWord文書のXML形式には対応していません。');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Word本文のXMLを読み取れません。');
  const body = document.getElementsByTagNameNS('*', 'body')[0];
  if (!body) throw new Error('Word本文がありません。');
  if (!body.getElementsByTagNameNS('*', 'tbl').length) return null;
  const readElement = (element: Element): string => {
    if (['del', 'delText', 'moveFrom'].includes(element.localName)) return '';
    if (element.localName === 'tbl') {
      return [...element.children].filter(child => child.localName === 'tr').map(row => {
        return [...row.children].filter(child => child.localName === 'tc').map(cell => {
          return [...cell.children].map(child => readElement(child)).filter(Boolean).join(' ').trim();
        }).join('\t');
      }).join('\n');
    }
    if (element.localName === 'p') return wordText(element);
    if (element.localName === 'sectPr' || element.localName === 'tcPr') return '';
    return [...element.children].map(readElement).filter(Boolean).join('\n');
  };
  return checkTextSize([...body.children].map(readElement).filter(Boolean).join('\n'));
}

async function readDocx(buffer: ArrayBuffer): Promise<ExtractedDocument> {
  if (!isZipSignature(new Uint8Array(buffer))) throw new Error('Word文書の形式を確認できません。Wordで.docx形式として保存し直してください。');
  try {
    // Text extraction only: never render Word-supplied HTML or load document links.
    const tableText = await readWordTables(buffer);
    const result = tableText === null ? await extractRawText({ arrayBuffer: buffer }) : { value: tableText, messages: [] };
    const text = checkTextSize(result.value);
    if (!text.trim()) throw new Error('Word文書に読み取れる文字がありません。画像内の文字にはOCRが必要です。');
    const warnings = [tableText === null ? 'Wordの段組み・改行は完全には復元できない場合があります。登録候補を確認してください。' : 'Wordの表はセル間をタブで区切って抽出しました。結合セルやセル内の改行は対応関係を確認してください。'];
    if (result.messages.length) warnings.push('文書内に未対応の要素がありました。本文の文字を抽出しています。');
    return { text, warnings, kind: 'docx' };
  } catch (error) {
    if (error instanceof Error && (error.message.includes('100万文字') || error.message.includes('読み取れる文字') || error.message.includes('分割'))) throw error;
    throw new Error('Word文書を読み込めませんでした。パスワード保護を外し、.docx形式で保存した文書を選択してください。');
  }
}

function readText(buffer: ArrayBuffer): ExtractedDocument {
  const bytes = new Uint8Array(buffer);
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(buffer); }
  catch { throw new Error('文字コードを読み取れませんでした。UTF-8のテキストまたはCSVとして保存し直してください。'); }
  checkTextSize(text);
  if (!text.trim()) throw new Error('ファイルに文字がありません。');
  if (text.includes('\0')) throw new Error('テキストとして読み取れないファイルです。UTF-8のテキストファイルを選択してください。');
  return { text, warnings: [], kind: 'text' };
}

/** Processes only the selected local file. No upload, remote AI, or training. */
export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (!file.size) throw new Error('ファイルが空です。');
  if (file.size > MAX_FILE_BYTES) throw new Error('ファイルは10MB以内で選択してください。大きな資料は分割してください。');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (extension === 'doc') throw new Error('旧形式の.docには対応していません。Wordで.docx形式に保存し直してください。');
  if (!['pdf', 'docx', 'txt', 'csv', 'tsv'].includes(extension ?? '')) throw new Error('PDF・Word（.docx）・TXT・CSV・TSVのいずれかを選択してください。');
  const buffer = await file.arrayBuffer();
  if (extension === 'pdf') return readPdf(buffer);
  if (extension === 'docx') return readDocx(buffer);
  return readText(buffer);
}
