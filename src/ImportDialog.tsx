import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, FolderInput, Info, Loader2, Upload } from 'lucide-react';
import type { Tag } from './domain';
import { categories } from './seed';
import { Dialog } from './Management';
import { extractDocument } from './documentExtract';
import { parseImportText } from './importParser';
import type { ImportCandidate, ImportOptions } from './importParser';

interface Props {
  tags: Tag[];
  adultMode: boolean;
  onClose: () => void;
  onImport: (tags: Tag[]) => void;
}

const PAGE_SIZE = 40;
const keyFor = (english: string, negative: boolean) => `${negative ? 'negative' : 'positive'}:${english.trim()}`;

export function ImportDialog({ tags, adultMode, onClose, onImport }: Props) {
  const [stage, setStage] = useState<'source' | 'review'>('source');
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  const [format, setFormat] = useState<ImportOptions['format']>('pairs');
  const [category, setCategory] = useState('outfit');
  const [mature, setMature] = useState(adultMode);
  const [group, setGroup] = useState('multi:custom');
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const existingKeys = useMemo(() => new Set(tags.map(t => keyFor(t.english, Boolean(t.negative)))), [tags]);

  function close() {
    if ((text || candidates.length || busy) && !window.confirm('取り込み途中の内容を破棄して閉じますか？ 辞書はまだ変更されていません。')) return;
    alive.current = false;
    onClose();
  }

  async function readFile(file?: File) {
    if (!file || busy) return;
    if (text && !window.confirm('現在の取り込み用テキストを、選んだ資料の内容で置き換えますか？')) return;
    setBusy(true); setError(''); setWarnings([]);
    try {
      const result = await extractDocument(file);
      if (!alive.current) return;
      setText(result.text); setWarnings(result.warnings); setSourceWarnings(result.warnings); setFilename(file.name);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : '資料を読み取れませんでした。テキストの貼り付けも利用できます。');
    } finally {
      if (alive.current) setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function review() {
    setError('');
    try {
      const result = parseImportText(text, { format, category, mature }, tags);
      if (!result.candidates.length) { setError('登録候補が見つかりません。本文または読み取り方を確認してください。'); return; }
      setCandidates(result.candidates.map(c => ({ ...c, group })));
      setWarnings([...new Set([...sourceWarnings, ...result.warnings])]);
      setStage('review'); setPage(0);
    } catch (e) { setError(e instanceof Error ? e.message : '候補を作成できませんでした。'); }
  }

  const statuses = useMemo(() => {
    const seen = new Set(existingKeys);
    return candidates.map(candidate => {
      const valid = Boolean(candidate.label.trim() && candidate.label.length <= 500 && candidate.english.trim() && candidate.english.length <= 100000 && /[A-Za-z]/.test(candidate.english));
      const key = keyFor(candidate.english, candidate.category === 'negative');
      const duplicate = seen.has(key);
      if (candidate.selected && valid && !duplicate) seen.add(key);
      return { valid, duplicate, ready: candidate.selected && valid && !duplicate };
    });
  }, [candidates, existingKeys]);
  const selectedCount = statuses.filter(s => s.ready).length;
  const duplicateCount = statuses.filter(s => s.duplicate).length;
  const pages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));

  function update(id: string, patch: Partial<ImportCandidate>) {
    setCandidates(previous => previous.map(c => c.id === id ? { ...c, ...patch } : c));
    setError('');
  }

  function selectAll(selected: boolean) {
    const seen = new Set(existingKeys);
    setCandidates(previous => previous.map(c => {
      const key = keyFor(c.english, c.category === 'negative');
      const valid = Boolean(c.label.trim() && c.label.length <= 500 && c.english.trim() && c.english.length <= 100000 && /[A-Za-z]/.test(c.english));
      const include = selected && valid && !seen.has(key);
      if (include) seen.add(key);
      return { ...c, selected: include };
    }));
  }

  function commit() {
    if (!selectedCount) { setError('登録する候補を選択してください。'); return; }
    if (tags.length + selectedCount > 20000) { setError('辞書の上限は20,000件です。不要な項目を整理してください。'); return; }
    const additions: Tag[] = candidates.filter((_, index) => statuses[index].ready).map(c => ({
      id: crypto.randomUUID(), label: c.label.trim(), english: c.english,
      category: c.category, group: c.group, mature: c.mature, negative: c.category === 'negative',
    }));
    try { onImport(additions); alive.current = false; } catch (e) { setError(e instanceof Error ? e.message : '登録できませんでした。'); }
  }

  return <Dialog title="資料から辞書へ一括登録" subtitle="PDF・Word・テキストから、手入力を減らす。資料は端末内で処理します。" onClose={close}>
    <div className="import-wizard">
      <div className="import-steps"><span className={stage === 'source' ? 'active' : 'done'}><b>{stage === 'review' ? <Check size={12}/> : '1'}</b>資料を読み取る</span><ArrowRight size={14}/><span className={stage === 'review' ? 'active' : ''}><b>2</b>確認して登録</span></div>
      {stage === 'source' ? <>
        <button className={`document-dropzone ${busy ? 'is-busy' : ''}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length > 1) { setError('資料は1ファイルずつ取り込んでください。'); return; } void readFile(e.dataTransfer.files[0]); }}>
          <span className="document-drop-icon">{busy ? <Loader2 size={26} className="spin"/> : filename ? <FileText size={26}/> : <Upload size={26}/>}</span>
          <strong>{busy ? '資料から文字を読み取っています…' : filename || 'ファイルを選ぶ・ここにドロップ'}</strong>
          <small>PDF / Word（.docx）/ TXT / CSV / TSV · 10MBまで</small>
        </button>
        <input ref={input} type="file" hidden accept=".pdf,.docx,.txt,.csv,.tsv" onChange={e => void readFile(e.target.files?.[0])}/>
        <div className="import-source-heading"><label htmlFor="import-text">読み取ったテキスト・直接貼り付け</label><span>{text.length.toLocaleString()} 文字</span></div>
        <textarea id="import-text" className="import-text" aria-label="取り込み用テキスト" value={text} onChange={e => { setText(e.target.value); setError(''); }} maxLength={1000000} rows={7} disabled={busy} placeholder={'日本語名と英語を並べた一覧を貼り付けるか、資料を選んでください。\n\n白いシャツ\twhite shirt\n柔らかい光\tsoft lighting\n\n英語だけの一覧も、そのまま候補にできます。'} spellCheck={false}/>
        <div className="import-options">
          <label className="field"><span>読み取り方</span><select aria-label="資料の読み取り方" value={format} onChange={e => setFormat(e.target.value as ImportOptions['format'])}><option value="pairs">対訳表：日本語と英語のペア</option><option value="lines">フレーズ一覧：1行を1項目にする</option><option value="prompt">プロンプト：括弧の外のカンマで分割</option></select></label>
          <label className="field"><span>取り込み先カテゴリ</span><select aria-label="取り込み先カテゴリ" value={category} onChange={e => { setCategory(e.target.value); setGroup('multi:custom'); }}>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label className="field"><span>選択時の扱い</span><select aria-label="取り込むタグの選択方式" value={group} onChange={e => setGroup(e.target.value)}><option value="multi:custom">複数選択・自動置換しない</option><option value="tops">トップスを置換</option><option value="bottoms">ボトムスを置換</option><option value="outfit-set">衣装セットを置換</option><option value="hair-style">髪型を置換</option><option value="expression">表情を置換</option><option value="posture">基本姿勢を置換</option><option value="place">主な場所を置換</option></select></label>
          <label className="field"><span>表示区分</span><select aria-label="取り込みの表示区分" value={mature ? 'adult' : 'general'} onChange={e => setMature(e.target.value === 'adult')}><option value="general">通常の辞書</option><option value="adult">成人向け辞書</option></select></label>
        </div>
        <div className="import-info"><Info size={15}/><p>{format === 'pairs' ? 'タブ・「→」・「|」・CSVの対訳表に対応します。英語だけの行は英語を表示名にし、日本語を勝手に補完しません。' : format === 'lines' ? '各行をそのまま1つのフレーズとして扱います。行内のカンマや重み付けは分解しません。' : 'カンマ区切りを明示的に分解します。括弧・重み付け・エスケープは保持します。分解結果を次の画面で確認してください。'}</p></div>
      </> : <>
        <div className="import-review-summary"><div><strong>{selectedCount}</strong><span>件を登録予定</span></div><span>候補 {candidates.length} 件 · 重複 {duplicateCount} 件</span><div className="import-select-actions"><button className="text-button" onClick={() => selectAll(true)}>登録できる候補をすべて選択</button><button className="text-button" onClick={() => selectAll(false)}>選択解除</button></div></div>
        <p className="import-review-help">名前・英語・カテゴリは修正できます。同じ英語の登録済み項目は上書きせずスキップします。日本語名は後から辞書画面でも編集できます。</p>
        <div className="import-table-wrap"><table className="import-table"><thead><tr><th>選択</th><th>表示名</th><th>英語フレーズ</th><th>カテゴリ</th></tr></thead><tbody>{candidates.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((candidate, offset) => {
          const status = statuses[page * PAGE_SIZE + offset];
          return <tr key={candidate.id} className={status.duplicate ? 'duplicate-row' : ''}><td><input type="checkbox" aria-label={`候補${page * PAGE_SIZE + offset + 1}を登録`} checked={candidate.selected && status.valid && !status.duplicate} disabled={!status.valid || status.duplicate} onChange={e => update(candidate.id, { selected: e.target.checked })}/></td><td><input aria-label={`候補${page * PAGE_SIZE + offset + 1}の表示名`} value={candidate.label} onChange={e => update(candidate.id, { label: e.target.value })} maxLength={500}/><small>{status.duplicate ? '同じ英語があるためスキップ' : !status.valid ? '英語と表示名を確認してください' : candidate.note || (candidate.mature ? '成人向け辞書' : `資料の${candidate.sourceLine}行目`)}</small></td><td><textarea aria-label={`候補${page * PAGE_SIZE + offset + 1}の英語`} value={candidate.english} onChange={e => update(candidate.id, { english: e.target.value, note: undefined })} rows={2} spellCheck={false}/></td><td><select aria-label={`候補${page * PAGE_SIZE + offset + 1}のカテゴリ`} value={candidate.category} onChange={e => update(candidate.id, { category: e.target.value })}>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>{candidate.mature && <span className="mature-manager-badge">成人向け</span>}</td></tr>;
        })}</tbody></table></div>
        <div className="import-pagination"><span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, candidates.length)} / {candidates.length} 件</span><button className="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>前へ</button><span>{page + 1} / {pages}</span><button className="button" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>次へ</button></div>
      </>}
      {warnings.length > 0 && <details className="import-warnings"><summary>読み取り時の確認事項（{warnings.length}件）</summary>{warnings.map((warning, i) => <p key={i}>{warning}</p>)}</details>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="import-footer"><span><FolderInput size={14}/>{stage === 'review' ? 'まだ辞書には登録していません' : '画像だけのPDFはOCRが必要です'}</span>{stage === 'source' ? <button className="button primary" disabled={busy || !text.trim()} onClick={review}>登録候補を確認<ArrowRight size={16}/></button> : <><button className="button" onClick={() => { setStage('source'); setError(''); }}><ArrowLeft size={14}/>資料に戻る</button><button className="button primary" disabled={!selectedCount} onClick={commit}><Check size={15}/>{selectedCount}件を一括登録</button></>}</footer>
    </div>
  </Dialog>;
}
