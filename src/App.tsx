import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Bookmark, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp, Clipboard, Copy, Database, Edit3, Eye, Feather, FolderHeart, LayoutGrid, Lightbulb, Loader2, Minus, Palette, Plus, RotateCcw, Search, Settings2, Shirt, SlidersHorizontal, Smile, Sparkles, Sun, Users, WandSparkles, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { buildPrompt, createInitialData, emptyWorkspace, toggleTag, validateBackup, upgradeCatalog, setAdultMode } from './domain';
import type { AppData, Character, SavedPrompt, Workspace } from './domain';
import { categories } from './seed';
import { tagGroups } from './tagGroups';
import { matchesTag } from './search';
import { CatalogMode, CatalogFilters } from './CatalogControls';
import type { CatalogScope } from './CatalogControls';
import { CharacterManager, DictionaryManager, Library } from './Management';
import { ImportDialog } from './ImportDialog';
import { downloadBackup, readData, readRecovery, writeData } from './storage';

const icons: Record<string, LucideIcon> = { outfit: Shirt, pose: Users, expression: Smile, composition: Eye, background: LayoutGrid, lighting: Sun, style: Palette, appearance: Feather, negative: Minus };

type Modal = 'characters' | 'dictionary' | 'library' | 'settings' | 'save' | 'raw' | 'help' | 'import' | null;

function Portrait({ character }: { character: Character }) {
  const blue = character.name.includes('すい') || character.english.includes('Suisei');
  const silver = character.name.includes('かなた') || character.english.includes('Kanata');
  const hair = blue ? '#6f9ac7' : silver ? '#d7dce9' : '#574c62';
  const dark = blue ? '#456d98' : silver ? '#a2acc6' : '#342b45';
  const eye = blue ? '#478ba8' : silver ? '#7984c0' : '#bd7c9e';
  return <svg className="portrait" viewBox="0 0 160 160" aria-hidden="true">
    <defs><linearGradient id={`bg-${character.id}`} x2="1" y2="1"><stop stopColor={character.color} stopOpacity=".24"/><stop offset="1" stopColor={character.color} stopOpacity=".06"/></linearGradient></defs>
    <circle cx="85" cy="82" r="64" fill={`url(#bg-${character.id})`}/><circle cx="140" cy="40" r="5" fill={character.color} opacity=".17"/><path d="m27 47 3-7 3 7 7 3-7 3-3 7-3-7-7-3z" fill={character.color} opacity=".35"/>
    <path d="M47 85C37 25 126 20 126 83l8 66H36z" fill={dark}/>
    <path d="M48 158c0-41 23-49 36-49 25 0 44 15 44 49" fill={blue ? '#e9f1f6' : silver ? '#f7f7fe' : '#ede0e9'}/>
    <path d="m74 107-3 16 13 13 14-13-5-16" fill="#f0d0c4"/><path d="m70 120 14 17-13 11-14-23m41-5-14 17 13 11 14-23" fill={blue ? '#527ca8' : silver ? '#b6bed8' : '#786284'}/>
    <path d="M54 70c0-35 60-35 60 0v18c-2 23-17 33-30 33S56 111 54 88z" fill="#fae4d8"/>
    <path d="M51 78C39 28 119 22 121 65l-3 23-8-21-3-13c-7 14-15 20-24 23l3-18c-9 13-19 18-28 21l4-17-9 22z" fill={hair}/>
    <path d="M48 78c-6 31 1 59-6 73l14-8 6-29-5-38m58-7c12 25 6 60 13 77l-13-7-6-40" fill={hair}/>
    <path d="M65 87q6-5 12 0m15 0q6-5 12 0" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round"/><ellipse cx="72" cy="91" rx="3.5" ry="5" fill={eye}/><ellipse cx="98" cy="91" rx="3.5" ry="5" fill={eye}/><circle cx="73" cy="89" r="1.3" fill="white"/><circle cx="99" cy="89" r="1.3" fill="white"/>
    <ellipse cx="64" cy="100" rx="6" ry="3" fill="#ecafa9" opacity=".45"/><ellipse cx="105" cy="100" rx="6" ry="3" fill="#ecafa9" opacity=".45"/><path d="M80 106q5 4 10-1" stroke="#bb8584" fill="none" strokeWidth="1.5" strokeLinecap="round"/>
    {blue ? <><path d="m103 43 9-19 6 16 15 3-12 9 1 16-12-10-14 4 5-13z" fill="#48698e"/><path d="m108 38 4-8 3 8 9 3-8 5 1 9-7-6-8 2 4-8z" fill="#a8c3d9"/></> : silver ? <><ellipse cx="83" cy="27" rx="29" ry="7" fill="none" stroke="#e3c67d" strokeWidth="3"/><path d="m110 54 11-3-5 12" fill="#e3c67d"/></> : <><path d="m107 53 12-4-1 13-12-2-5 10-5-10z" fill="#c17caa"/><circle cx="108" cy="59" r="3" fill="#f8d7e9"/></>}
    <path d="m80 137 4 5 4-5 2 15-6 6-6-6z" fill={blue ? '#70a4be' : silver ? '#d8c58c' : '#c48faa'}/>
  </svg>;
}

export default function App() {
  const [data, setData] = useState<AppData>(() => createInitialData());
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const [saveStatus, setSaveStatus] = useState('保存済み');
  const [category, setCategory] = useState('outfit');
  const [search, setSearch] = useState('');
  const [catalogScope, setCatalogScope] = useState<CatalogScope>('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [modal, setModal] = useState<Modal>(null);
  const [tab, setTab] = useState<'positive' | 'negative'>('positive');
  const [mobileOutput, setMobileOutput] = useState(false);
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [rawPositive, setRawPositive] = useState('');
  const [rawNegative, setRawNegative] = useState('');
  const [modalError, setModalError] = useState('');
  const [lineBreaks, setLineBreaks] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<AppData | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const undoRef = useRef<Workspace | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawDirtyRef = useRef(false);
  rawDirtyRef.current = modal === 'raw' && Boolean(saveName || rawPositive || rawNegative);
  function closeModal() {
    if (rawDirtyRef.current && !window.confirm('入力した原文がまだ保存されていません。破棄して閉じますか？')) return;
    setModal(null);
  }

  useEffect(() => { let active = true; readData().then(stored => {
    if (active && stored !== undefined) {
      const upgraded = upgradeCatalog(validateBackup(stored));
      setData(upgraded.data);
      if (upgraded.added > 0) setToast(`辞書に ${upgraded.added} 件を追加しました。登録済みの内容は保持しています。`);
    }
  }).catch(() => { if (active) { setCanPersist(false); setSaveStatus('保存できません'); setToast('保存データを読み込めませんでした。設定からバックアップを復元できます。'); } }).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!ready || !canPersist) return;
    setSaveStatus('保存中');
    const timeout = setTimeout(() => { saveTimerRef.current = null; writeData(data).then(() => setSaveStatus('保存済み')).catch(() => { setSaveStatus('保存失敗'); setToast('保存に失敗しました。バックアップを書き出してください。'); }); }, 300);
    saveTimerRef.current = timeout;
    return () => clearTimeout(timeout);
  }, [data, ready, canPersist]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => { setToast(''); undoRef.current = null; }, 4500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !modal) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape' && !['characters', 'dictionary', 'library', 'import'].includes(modal ?? '')) { closeModal(); setMobileOutput(false); }
    }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [modal]);
  useEffect(() => { setModalError(''); setRestoreCandidate(null); }, [modal]);
  useEffect(() => {
    if (!modal || ['characters', 'dictionary', 'library', 'import'].includes(modal)) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      document.querySelector<HTMLElement>('.modal-backdrop [role="dialog"] input, .modal-backdrop [role="dialog"] button')?.focus();
    }, 0);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const dialog = document.querySelector('.modal-backdrop [role="dialog"]');
      const nodes = [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter(node => node.offsetParent !== null);
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { clearTimeout(timer); document.removeEventListener('keydown', trap); document.body.style.overflow = old; previous?.focus(); };
  }, [modal]);

  useEffect(() => {
    if (!mobileOutput || !window.matchMedia('(max-width: 660px)').matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = document.querySelector<HTMLElement>('.output-panel');
    panel?.querySelector<HTMLElement>('button')?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || document.querySelector('.modal-backdrop')) return;
      const nodes = [...(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)') ?? [])].filter(n => n.offsetParent !== null);
      if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [mobileOutput]);

  const w = data.workspace;
  const result = useMemo(() => buildPrompt(w, data.characters, data.tags), [w, data.characters, data.tags]);
  const selectedCharacter = data.characters.find(c => c.id === w.characterId);
  const currentCategory = categories.find(c => c.id === category) ?? categories[0];
  const availableTags = data.tags.filter(tag => w.adultMode || !tag.mature);
  const matchedTags = availableTags.filter(tag => search.trim() ? matchesTag(tag, search) : tag.category === category);
  const availableGroups = [...new Set(matchedTags.map(t => t.group))];
  const effectiveGroup = availableGroups.includes(groupFilter) ? groupFilter : 'all';
  const filteredTags = matchedTags.filter(tag => (effectiveGroup === 'all' || tag.group === effectiveGroup) && (catalogScope !== 'selected' || w.selectedIds.includes(tag.id)) && (catalogScope !== 'mature' || tag.mature));
  const groups = [...new Set(filteredTags.map(t => t.group))];
  const positive = w.editedPositive ?? result.positive;
  const negative = w.editedNegative ?? result.negative;
  const activeText = tab === 'positive' ? positive : negative;
  const edited = tab === 'positive' ? w.editedPositive !== null : w.editedNegative !== null;
  const generated = tab === 'positive' ? result.positive : result.negative;
  const activeBlocks = result.blocks.filter(b => b.negative === (tab === 'negative'));
  const selectCount = w.selectedIds.length + (w.characterId ? 1 : 0) + (w.quality ? 1 : 0);
  const updateWorkspace = (patch: Partial<Workspace>) => setData(d => ({ ...d, workspace: { ...d.workspace, ...patch } }));
  const notify = (message: string, undo?: Workspace) => { undoRef.current = undo ? structuredClone(undo) : null; setToast(message); };
  const changeCategory = (id: string) => { setCategory(id); setSearch(''); setGroupFilter('all'); };
  const changeAdultMode = (enabled: boolean) => {
    setData(d => ({ ...d, workspace: setAdultMode(d.workspace, enabled, d.tags) }));
    if (!enabled && catalogScope === 'mature') setCatalogScope('all');
    notify(enabled ? '成人向け衣装の辞書を表示しました。タグは自動追加されません。' : '成人向けタグの選択を解除しました。原文・手動編集・自由入力はそのまま保持します。');
  };
  const reset = () => { undoRef.current = structuredClone(w); updateWorkspace({ ...emptyWorkspace, selectedIds: [], adultMode: w.adultMode ?? false }); notify('新しいプロンプトを作成しました', w); };
  const chooseCharacter = (id: string) => updateWorkspace({ characterId: w.characterId === id ? null : id, hairVariantId: null, outfitVariantId: null, suppressedBlockIds: [] });

  async function copyPrompt() {
    if (!activeText) return;
    const text = lineBreaks && !edited ? activeBlocks.map(b => b.english).join(',\n') : activeText;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); notify(`${tab === 'positive' ? 'ポジティブ' : 'ネガティブ'}をコピーしました`); }
    catch { outputRef.current?.focus(); outputRef.current?.select(); notify('コピーできませんでした。出力欄の文字列を選択してコピーしてください。'); }
  }
  function openSave(raw = false) {
    setSaveName(''); setRawPositive(''); setRawNegative(''); setModal(raw ? 'raw' : 'save');
  }
  function savePrompt() {
    if (!saveName.trim()) { setModalError('保存名を入力してください'); return; }
    const p = modal === 'raw' ? rawPositive : positive;
    const n = modal === 'raw' ? rawNegative : negative;
    if (!p.trim() && !n.trim()) { setModalError('プロンプトを入力してください'); return; }
    const saved: SavedPrompt = { id: crypto.randomUUID(), name: saveName.trim(), positive: p, negative: n, createdAt: new Date().toISOString(), ...(modal === 'save' ? { workspace: structuredClone(w) } : {}) };
    setData(d => ({ ...d, saved: [saved, ...d.saved] })); setModal(null); notify('ライブラリに保存しました');
  }
  function loadPrompt(saved: SavedPrompt) {
    undoRef.current = structuredClone(w);
    const restored = structuredClone(saved.workspace ?? { ...emptyWorkspace, selectedIds: [] });
    const character = data.characters.find(c => c.id === restored.characterId);
    restored.characterId = character?.id ?? null;
    restored.hairVariantId = character?.variants.some(v => v.id === restored.hairVariantId && v.kind === 'hair') ? restored.hairVariantId : null;
    restored.outfitVariantId = character?.variants.some(v => v.id === restored.outfitVariantId && v.kind === 'outfit') ? restored.outfitVariantId : null;
    restored.selectedIds = restored.selectedIds.filter(id => data.tags.some(t => t.id === id));
    const rebuilt = buildPrompt(restored, data.characters, data.tags);
    const autoPositive = Boolean(saved.workspace) && restored.editedPositive === null && rebuilt.positive === saved.positive;
    const autoNegative = Boolean(saved.workspace) && restored.editedNegative === null && rebuilt.negative === saved.negative;
    updateWorkspace({ ...restored, editedPositive: autoPositive ? null : saved.positive, editedNegative: autoNegative ? null : saved.negative });
    setModal(null); setTab('positive'); notify(autoPositive && autoNegative ? '組み合わせを読み込みました' : '保存時の英語をそのまま読み込みました', w);
  }
  async function readFile(file?: File) {
    if (!file) return;
    setRestoreCandidate(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('10MB以下のJSONを選択してください');
      setRestoreCandidate(upgradeCatalog(validateBackup(JSON.parse(await file.text()))).data); setModalError('');
    } catch (e) { setModalError(e instanceof Error ? e.message : 'ファイルを読み込めません'); }
    if (fileRef.current) fileRef.current.value = '';
  }
  async function restore() {
    if (!restoreCandidate) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    try { await writeData(restoreCandidate, data); setData(restoreCandidate); setCanPersist(true); setRestoreCandidate(null); notify('バックアップを復元しました'); }
    catch { setModalError('復元に失敗しました。現在のデータは変更していません。'); }
  }

  if (!ready) return <div className="loading"><div className="brand-mark"><Feather size={26}/></div><Loader2 className="spin"/> ワークスペースを準備しています</div>;

  return <>
    <header className="topbar">
      <a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="iroha ホーム"><span className="brand-mark"><Feather size={23}/></span><span>iroha<span className="brand-period">.</span></span><span className="brand-caption">PROMPT STUDIO</span></a>
      <div className="topbar-center"><span className="topbar-link active">ワークスペース</span><button className="topbar-link" onClick={() => setModal('library')}>ライブラリ <span className="tiny-count">{data.saved.length}</span></button></div>
      <div className="topbar-actions"><span className={`save-status ${saveStatus.includes('失敗') || !canPersist ? 'error' : ''}`}><span className="status-dot"/>{saveStatus}</span><button className="icon-button mobile-library" aria-label="ライブラリを開く" onClick={() => setModal('library')}><FolderHeart size={19}/></button><button className="icon-button help-button" aria-label="使い方" onClick={() => setModal('help')}><CircleHelp size={19}/></button><button className="icon-button settings-button" aria-label="保存と設定" onClick={() => setModal('settings')}><Settings2 size={19}/></button></div>
    </header>
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-label">WORKSPACE</div>
        <button className="sidebar-action selected" onClick={() => { setMobileOutput(false); setModal(null); }}><WandSparkles size={18}/>プロンプト作成<span className="nav-indicator"/></button>
        <button className="sidebar-action" onClick={() => setModal('characters')}><Users size={18}/>キャラクター<span className="nav-count">{data.characters.length}</span></button>
        <button className="sidebar-action" onClick={() => setModal('library')}><FolderHeart size={18}/>保存したプロンプト</button>
        <div className="sidebar-divider"/>
        <div className="sidebar-label category-label">CATEGORIES <span>{categories.length}</span></div>
        <nav aria-label="タグカテゴリ" className="category-nav">{categories.map(c => { const Icon = icons[c.id] ?? Sparkles; const count = data.tags.filter(t => t.category === c.id && w.selectedIds.includes(t.id)).length; return <button key={c.id} onClick={() => changeCategory(c.id)} className={`category-button ${category === c.id ? 'active' : ''}`} aria-pressed={category === c.id}><Icon size={17}/><span>{c.label}</span>{count > 0 ? <span className="category-count">{count}</span> : category === c.id ? <ChevronRight size={14}/> : null}</button>; })}</nav>
        <div className="sidebar-bottom"><div className="model-card"><span className="model-icon"><Sparkles size={18}/></span><div><small>YOUR CREATIVE SPACE</small><strong>Illustrious family</strong></div><span className="model-dot"/></div><button className="sidebar-footer" onClick={() => setModal('settings')}><Database size={14}/> このブラウザに保存 <ChevronRight size={13}/></button></div>
      </aside>
      <main className={`workspace ${mobileOutput ? 'mobile-hidden' : ''}`} inert={mobileOutput || undefined}>
        <section className="workspace-heading"><div><div className="eyebrow"><span/> YOUR IMAGINATION, IN WORDS</div><h1>イメージを、言葉に<span>。</span></h1><p>日本語で選ぶだけ。あなたらしいプロンプトを。</p></div><button className="button new-button" onClick={reset}><Plus size={16}/>新規作成</button></section>
        {!canPersist && <div className="notice error-notice">端末内保存を利用できません。設定からバックアップを読み込むか、現在の内容を書き出してください。<button onClick={() => setModal('settings')}>設定を開く</button></div>}
        <section className="character-section">
          <div className="section-heading"><div className="section-title"><span className="section-number">01</span><h2>キャラクター</h2><span className="optional-badge">任意</span></div><button className="text-button" onClick={() => setModal('characters')}><SlidersHorizontal size={14}/>管理する<ChevronRight size={13}/></button></div>
          <div className="character-grid">{data.characters.slice(0, 3).map(character => <button key={character.id} className={`character-card ${w.characterId === character.id ? 'chosen' : ''}`} onClick={() => chooseCharacter(character.id)} aria-pressed={w.characterId === character.id} style={{ '--character-color': character.color } as React.CSSProperties}><span className="character-art"><Portrait character={character}/></span><span className="character-info"><span className="character-affiliation">{character.affiliation || 'ORIGINAL'}</span><strong>{character.name}</strong><small>{character.english.split(/[,(]/)[0]}</small></span><span className="character-check">{w.characterId === character.id ? <Check size={12}/> : <Plus size={12}/>}</span></button>)}</div>
          <div className="character-picker"><label><Users size={12}/><select aria-label="すべてのキャラクターから選択" value={w.characterId ?? ''} onChange={e => updateWorkspace({ characterId: e.target.value || null, hairVariantId: null, outfitVariantId: null, suppressedBlockIds: [] })}><option value="">キャラクターを指定しない</option>{data.characters.map(c => <option value={c.id} key={c.id}>{c.name} — {c.affiliation || 'オリジナル'}</option>)}</select></label><span>{data.characters.length} characters</span></div>
          {selectedCharacter ? <div className="variant-bar"><span className="variant-label"><Check size={13}/>{selectedCharacter.name}</span><label>髪型<select aria-label="髪型差分" value={w.hairVariantId ?? ''} onChange={e => { const variant = selectedCharacter.variants.find(v => v.id === e.target.value); updateWorkspace({ hairVariantId: e.target.value || null, suppressedBlockIds: (w.suppressedBlockIds ?? []).filter(id => !id.startsWith('character-hair')), selectedIds: variant ? w.selectedIds.filter(id => { const group = data.tags.find(t => t.id === id)?.group; return !(group === 'hair-style' && 'hairStyle' in variant.overrides) && !(group === 'hair-color' && 'hairColor' in variant.overrides); }) : w.selectedIds }); }}><option value="">基本の髪型</option>{selectedCharacter.variants.filter(v => v.kind === 'hair').map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><label>衣装<select aria-label="衣装差分" value={w.outfitVariantId ?? ''} onChange={e => updateWorkspace({ outfitVariantId: e.target.value || null, suppressedBlockIds: (w.suppressedBlockIds ?? []).filter(id => id !== 'variant-outfit'), selectedIds: e.target.value ? w.selectedIds.filter(id => !['tops', 'bottoms', 'outfit-set'].includes(data.tags.find(t => t.id === id)?.group ?? '')) : w.selectedIds })}><option value="">指定なし</option>{selectedCharacter.variants.filter(v => v.kind === 'outfit').map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><button className="icon-button" aria-label="キャラクターを解除" onClick={() => updateWorkspace({ characterId: null, hairVariantId: null, outfitVariantId: null })}><X size={14}/></button></div> : <p className="section-hint"><Lightbulb size={13}/>キャラクターを選ばず、タグだけでも作成できます。</p>}
        </section>
        <section className="tag-section">
          <div className="section-heading"><div className="section-title"><span className="section-number">02</span><h2>シーンをつくる</h2></div><div className="dictionary-tools"><button className="text-button import-open-button" onClick={() => setModal('import')}><ArrowUpFromLine size={14}/>資料から一括登録</button><button className="text-button" onClick={() => setModal('dictionary')}><BookOpen size={14}/>辞書を編集<ChevronRight size={13}/></button></div></div>
          <CatalogMode adultMode={Boolean(w.adultMode)} onAdultModeChange={changeAdultMode} total={data.tags.length} matureCount={data.tags.filter(t => t.mature).length}/><div className="search-box"><Search size={18}/><input ref={searchRef} value={search} onChange={e => { setSearch(e.target.value); setGroupFilter('all'); }} placeholder="日本語・英語・別名でタグを検索..." aria-label="タグを検索"/>{search ? <button className="icon-button" aria-label="検索をクリア" onClick={() => setSearch('')}><X size={15}/></button> : <kbd>⌘ K</kbd>}</div>
          <div className="mobile-categories">{categories.map(c => <button key={c.id} className={category === c.id ? 'active' : ''} onClick={() => changeCategory(c.id)}>{c.label}</button>)}</div>
          <CatalogFilters adultMode={Boolean(w.adultMode)} scope={catalogScope} onScopeChange={setCatalogScope} groups={availableGroups.map(g => ({ value: g, label: tagGroups[g.replace('multi:', '')] ?? 'その他' }))} group={effectiveGroup} onGroupChange={setGroupFilter} selectedCount={matchedTags.filter(t => w.selectedIds.includes(t.id)).length}/><div className="category-heading"><div><span className="category-icon">{(() => { const Icon = search ? Search : icons[category] ?? Sparkles; return <Icon size={19}/>; })()}</span><h3>{search ? '検索結果' : currentCategory.label}</h3><span className="result-count">{filteredTags.length}</span></div><button className="text-button muted" onClick={() => { undoRef.current = structuredClone(w); updateWorkspace({ selectedIds: w.selectedIds.filter(id => !filteredTags.some(t => t.id === id)), ...(category === 'outfit' && !search ? { outfitVariantId: null } : {}) }); notify('表示中のカテゴリをクリアしました', w); }}><RotateCcw size={12}/>クリア</button></div>
          <p className="category-description">{search ? `「${search}」に一致するすべてのカテゴリのタグ` : currentCategory.description}</p>
          <div className="tag-groups">{groups.map(group => <div className="tag-group" key={group}><div className="group-label">{tagGroups[group.replace('multi:', '')] ?? 'その他の指定'}<span>{group.startsWith('multi:') ? '複数選択可' : 'ひとつ選択'}</span></div><div className="tag-grid">{filteredTags.filter(t => t.group === group).map(tag => { const isSelected = w.selectedIds.includes(tag.id); return <button className={`tag-option ${isSelected ? 'selected' : ''} ${tag.mature ? 'mature-tag' : ''}`} title={tag.keywords?.join('・')} key={tag.id} data-tag-id={tag.id} data-mature={Boolean(tag.mature)} onClick={() => setData(d => ({ ...d, workspace: { ...toggleTag(d.workspace, tag, d.tags),  } }))} aria-pressed={isSelected}><span className="tag-option-copy"><strong>{tag.label}{tag.mature && <span className="mature-tag-badge">18+</span>}</strong><small>{tag.english}</small></span><span className="tag-indicator">{isSelected ? <Check size={12}/> : <Plus size={12}/>}</span></button>; })}</div></div>)}</div>
          {!filteredTags.length && <div className="empty-state"><Search size={28}/><strong>一致するタグがありません</strong><p>{catalogScope === 'selected' ? 'この範囲には選択中のタグがありません。' : '検索語や絞り込みを変えるか、辞書に追加してください。'}</p><button className="text-button" onClick={() => { setSearch(''); setGroupFilter('all'); setCatalogScope('all'); }}>絞り込みを解除</button><button className="button" onClick={() => setModal('dictionary')}><Plus size={15}/>タグを登録</button></div>}
          <div className="custom-input"><div className="group-label">自由入力<span>入力した英語をそのまま追加</span></div><textarea aria-label="ポジティブの補足英語" value={w.positiveExtra} onChange={e => updateWorkspace({ positiveExtra: e.target.value })} placeholder="辞書にない英語のタグやフレーズを追加..." rows={2}/><details><summary>ネガティブの自由入力<ChevronDown size={13}/></summary><textarea aria-label="ネガティブの補足英語" value={w.negativeExtra} onChange={e => updateWorkspace({ negativeExtra: e.target.value })} placeholder="除外したい要素の英語を追加..." rows={2}/></details></div>
        </section>
        <footer className="workspace-footer"><Feather size={13}/><span>選んだ言葉だけで、あなたのイメージを。</span><span>iroha studio · prototype</span></footer>
      </main>
      <aside className={`output-panel ${mobileOutput ? 'mobile-open' : ''}`} aria-label="プロンプトの確認" role={mobileOutput && !modal ? 'dialog' : undefined} aria-modal={mobileOutput && !modal || undefined} inert={Boolean(modal) || undefined}>
        <div className="output-top"><div><span className="eyebrow">YOUR PROMPT</span><h2>プロンプト</h2></div><span className="live-badge"><span/>LIVE</span><button className="icon-button mobile-close" aria-label="選択に戻る" onClick={() => setMobileOutput(false)}><X size={20}/></button></div>
        <div className="output-tabs"><button className={tab === 'positive' ? 'active' : ''} onClick={() => setTab('positive')}>ポジティブ<span>{result.blocks.filter(b => !b.negative).length}</span></button><button className={tab === 'negative' ? 'active' : ''} onClick={() => setTab('negative')}>ネガティブ<span>{result.blocks.filter(b => b.negative).length}</span></button></div>
        <div className="output-scroll">
          <div className="selection-heading"><span>選択中の項目</span><span>{activeBlocks.length} ITEMS</span></div>
          <div className="selected-tags">{activeBlocks.map(block => <div className={`selected-chip source-${block.source}`} key={block.id} title={block.english}><span>{block.source === 'character' ? <Users size={11}/> : block.source === 'quality' ? <Sparkles size={11}/> : null}{block.label}</span><button aria-label={`${block.label}を解除`} onClick={() => {
            if (block.source === 'quality') updateWorkspace({ quality: false });
            else if (block.id === 'character') updateWorkspace({ characterId: null, hairVariantId: null, outfitVariantId: null, suppressedBlockIds: [] });
            else if (block.source === 'character' || block.source === 'variant') updateWorkspace({ suppressedBlockIds: [...(w.suppressedBlockIds ?? []), block.id] });
            else if (block.source === 'extra') updateWorkspace(block.negative ? { negativeExtra: '' } : { positiveExtra: '' });
            else updateWorkspace({ selectedIds: w.selectedIds.filter(id => id !== block.id && `tag:${id}` !== block.id) });
          }}><X size={11}/></button></div>)}</div>
          {!activeBlocks.length && <div className="selection-empty"><span className="empty-spark"><Sparkles size={22}/></span><p>まだ選択されていません</p><small>気になるタグを選んでみましょう</small></div>}
          <div className="output-editor-heading"><label htmlFor="prompt-output">ENGLISH PROMPT</label><button className={`text-button ${edited ? 'editing-label' : ''}`} onClick={() => { if (edited) { if (window.confirm('手動編集版を破棄し、現在の選択から生成した内容に戻しますか？')) updateWorkspace(tab === 'positive' ? { editedPositive: null } : { editedNegative: null }); } else { updateWorkspace(tab === 'positive' ? { editedPositive: positive } : { editedNegative: negative }); outputRef.current?.focus(); } }}><Edit3 size={12}/>{edited ? '選択から再生成' : '手動編集'}</button></div>
          {edited && <div className="edit-notice"><Edit3 size={12}/>{activeText !== generated ? '手動編集版を保持中。選択変更は上書きしません。' : '手動編集モード。入力内容は独立して保持します。'}</div>}
          <div className={`prompt-box ${edited ? 'is-editing' : ''}`}><textarea id="prompt-output" ref={outputRef} aria-label={`${tab === 'positive' ? 'ポジティブ' : 'ネガティブ'}の英語プロンプト`} readOnly={!edited} value={lineBreaks && !edited ? activeBlocks.map(b => b.english).join(',\n') : activeText} onChange={e => updateWorkspace(tab === 'positive' ? { editedPositive: e.target.value } : { editedNegative: e.target.value })} placeholder="選択した内容が、ここに英語で表示されます。" spellCheck={false}/><div className="prompt-meta"><span>{activeText.length} characters</span><span>{edited ? 'EDITED' : 'AUTO'}</span></div></div>
          <label className="checkbox-label linebreak-option"><input type="checkbox" checked={lineBreaks} onChange={e => setLineBreaks(e.target.checked)} disabled={edited}/>項目ごとに改行してコピー</label>
          <div className="quality-card"><span className="quality-icon"><Sparkles size={18}/></span><div><strong>品質タグセット</strong><small>masterpiece, best quality…</small></div><button className={`switch ${w.quality ? 'on' : ''}`} role="switch" aria-checked={w.quality} aria-label="品質タグセット" onClick={() => updateWorkspace({ quality: !w.quality })}><span/></button></div>
          <button className="raw-link" onClick={() => openSave(true)}><Clipboard size={14}/>成功したプロンプトを原文で登録<ArrowRight size={14}/></button>
          <div className="output-tip"><Lightbulb size={15}/><p>指定は少なく、イメージは自由に。<br/>必要な項目だけを選びましょう。</p></div>
        </div>
        <div className="output-actions"><button className={`copy-button ${copied ? 'copied' : ''}`} disabled={!activeText} onClick={copyPrompt}>{copied ? <Check size={18}/> : <Copy size={18}/>}<span>{copied ? 'コピーしました' : 'プロンプトをコピー'}</span>{!copied && <ArrowRight size={17}/>}</button><button className="save-prompt-button" disabled={!positive && !negative} onClick={() => openSave()}><Bookmark size={16}/>組み合わせを保存</button><div className="output-footnote"><span className="status-dot"/>SeaArt AI などに貼り付けて使えます</div></div>
      </aside>
    </div>
    <button className="mobile-output-button" onClick={() => setMobileOutput(true)}><span><Sparkles size={17}/>選択中 <b>{selectCount}</b> 件</span><span>出力を確認<ArrowRight size={16}/></span></button>
    {toast && <div className="toast" role="status"><Check size={16}/>{toast}{undoRef.current && <button onClick={() => { const prev = structuredClone(undoRef.current!); const c = data.characters.find(c => c.id === prev.characterId); prev.characterId = c?.id ?? null; prev.hairVariantId = c?.variants.some(v => v.id === prev.hairVariantId) ? prev.hairVariantId : null; prev.outfitVariantId = c?.variants.some(v => v.id === prev.outfitVariantId) ? prev.outfitVariantId : null; prev.selectedIds = prev.selectedIds.filter(id => data.tags.some(t => t.id === id)); updateWorkspace(prev); undoRef.current = null; setToast('元に戻しました'); }}>元に戻す</button>}<button className="icon-button" aria-label="通知を閉じる" onClick={() => { undoRef.current = null; setToast(''); }}><X size={14}/></button></div>}
    {modal === 'characters' && <CharacterManager characters={data.characters} onChange={characters => setData(d => { const c = characters.find(c => c.id === d.workspace.characterId); return { ...d, characters, workspace: { ...d.workspace, characterId: c?.id ?? null, hairVariantId: c?.variants.some(v => v.id === d.workspace.hairVariantId && v.kind === 'hair') ? d.workspace.hairVariantId : null, outfitVariantId: c?.variants.some(v => v.id === d.workspace.outfitVariantId && v.kind === 'outfit') ? d.workspace.outfitVariantId : null } }; })} onClose={() => setModal(null)}/>}
    {modal === 'dictionary' && <DictionaryManager onImport={() => setModal('import')} adultMode={Boolean(w.adultMode)} tags={data.tags} onChange={tags => setData(d => ({ ...d, tags, hiddenTagIds: [...new Set([...(d.hiddenTagIds ?? []), ...d.tags.filter(t => !tags.some(next => next.id === t.id)).map(t => t.id)])], workspace: { ...d.workspace, selectedIds: d.workspace.selectedIds.filter(id => tags.some(t => t.id === id)) } }))} onClose={() => setModal(null)}/>}
    {modal === 'import' && <ImportDialog tags={data.tags} adultMode={Boolean(w.adultMode)} onClose={() => setModal(null)} onImport={additions => { setData(d => ({ ...d, tags: [...d.tags, ...additions], workspace: { ...d.workspace, adultMode: d.workspace.adultMode || additions.some(t => t.mature) } })); setModal(null); notify(`${additions.length}件を辞書に追加しました。タグはまだ選択されていません。`); }}/> }
    {modal === 'library' && <Library saved={data.saved} onLoad={loadPrompt} onDelete={id => setData(d => ({ ...d, saved: d.saved.filter(s => s.id !== id) }))} onClose={() => setModal(null)}/>}
    {(modal === 'save' || modal === 'raw' || modal === 'settings' || modal === 'help') && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}><div ref={modalRef} className={`modal ${modal === 'raw' ? 'modal-medium' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modal-header"><div><span className="eyebrow">{modal === 'settings' ? 'YOUR DATA' : modal === 'help' ? 'GETTING STARTED' : 'PROMPT LIBRARY'}</span><h2 id="dialog-title">{modal === 'save' ? '組み合わせを保存' : modal === 'raw' ? '英語プロンプトを原文で登録' : modal === 'settings' ? '保存とバックアップ' : 'iroha の使い方'}</h2></div><button className="icon-button" aria-label="閉じる" onClick={closeModal}><X size={21}/></button></div><div className="modal-body">
      {(modal === 'save' || modal === 'raw') && <form onSubmit={e => { e.preventDefault(); savePrompt(); }}><label className="field">保存名<input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="例：いつもの制服・上半身" maxLength={100}/></label>{modal === 'raw' ? <><p className="form-hint">記号や改行も含め、入力した英語をそのまま保存します。</p><label className="field">ポジティブ<textarea rows={7} value={rawPositive} onChange={e => setRawPositive(e.target.value)} placeholder="成功した英語プロンプトを貼り付け..." spellCheck={false}/></label><label className="field">ネガティブ（任意）<textarea rows={3} value={rawNegative} onChange={e => setRawNegative(e.target.value)} spellCheck={false}/></label></> : <div className="save-preview"><span>POSITIVE</span><p>{positive || '指定なし'}</p>{negative && <><span>NEGATIVE</span><p>{negative}</p></>}</div>}{modalError && <p className="form-error" role="alert">{modalError}</p>}<div className="form-actions"><button className="button" type="button" onClick={closeModal}>キャンセル</button><button className="button primary" type="submit"><Bookmark size={15}/>保存する</button></div></form>}
      {modal === 'settings' && <><div className="storage-summary"><span className="storage-icon"><Database size={23}/></span><div><strong>このブラウザに保存しています</strong><p>ログイン不要。登録内容は外部に送信しません。</p></div></div><div className="data-counts"><div><strong>{data.characters.length}</strong><span>キャラクター</span></div><div><strong>{data.tags.length}</strong><span>辞書のタグ</span></div><div><strong>{data.saved.length}</strong><span>保存プロンプト</span></div></div><div className="catalog-settings-info"><BookOpen size={15}/><div><strong>拡張辞書 v{data.catalogVersion ?? 1}</strong><p>一般 {data.tags.filter(t => !t.mature).length} 件・成人向け衣装 {data.tags.filter(t => t.mature).length} 件。追加辞書は不足分だけ取り込み、編集済みの英語は維持します。</p></div></div><div className="settings-section"><h3>バックアップ</h3><p>別の端末への移行にも使えます。ブラウザのデータを削除する前に書き出してください。</p><button className="button full-width" onClick={() => { downloadBackup(data); notify('バックアップを書き出しました'); }}><ArrowDownToLine size={16}/>JSONを書き出す</button><button className="button full-width" onClick={() => fileRef.current?.click()}><ArrowUpFromLine size={16}/>JSONから復元する</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => readFile(e.target.files?.[0])}/>{restoreCandidate && <div className="restore-confirm"><strong>現在のデータを置き換えます</strong><p>キャラクター {restoreCandidate.characters.length} 件・タグ {restoreCandidate.tags.length} 件・保存 {restoreCandidate.saved.length} 件</p><small>置換前のデータは端末内に退避します。</small><div className="form-actions"><button className="button" onClick={() => setRestoreCandidate(null)}>キャンセル</button><button className="button primary" onClick={restore}>復元を実行</button></div></div>}<button className="text-button recovery-link" onClick={async () => { try { const previous = await readRecovery(); if (!previous) { setModalError('復元前の退避データはありません'); return; } downloadBackup(validateBackup(previous), 'iroha-before-restore'); notify('復元前のデータを書き出しました'); } catch { setModalError('退避データを読み込めませんでした'); } }}>前回の復元前データを書き出す</button>{modalError && <p className="form-error" role="alert">{modalError}</p>}</div><div className="notice"><Lightbulb size={16}/><p>PCとスマートフォンの保存先は別です。初期版は自動同期に対応していません。</p></div></>}
      {modal === 'help' && <><p className="help-intro">日本語で選んで、イメージを言葉に。<br/>必要な指定だけで、プロンプトをつくりましょう。</p>{[['01', 'キャラクターを選ぶ', '選ばなくても使えます。基本外見や髪型・衣装の差分を呼び出せます。'], ['02', '必要なタグを選ぶ', 'カテゴリや検索から日本語で選択。選んだ内容だけが英語になります。'], ['03', '確認してコピー', 'SeaArt AIなどへ貼り付け。気に入った組み合わせはライブラリへ。']].map(([n,title,description]) => <div className="help-step" key={n}><span className="section-number">{n}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}<div className="notice">手動編集した英語は、選択を変更しても上書きしません。「選択から再生成」で通常の出力に戻せます。</div><button className="button primary full-width" onClick={() => setModal(null)}>つくりはじめる<ArrowRight size={16}/></button></>}
    </div></div></div>}
  </>;
}
