import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight, BookOpen, Check, Copy, Heart, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { Character, Tag, SavedPrompt } from './domain';
import { categories } from './seed';
import { matchesTag } from './search';
import { tagGroups } from './tagGroups';

export function Dialog({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
    function handleKeys(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]') ?? [])].filter(node => node.offsetParent !== null);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', handleKeys);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKeys); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
      <header className="modal-header"><div><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="閉じる"><X size={20} /></button></header>
      <div className="modal-body">{children}</div>
    </div>
  </div>;
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="manager-search"><Search size={16} /><input aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function Field({ label, value, onChange, placeholder, multiline = false, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; required?: boolean }) {
  return <label className="field"><span>{label}{required && <span className="required-mark"> *</span>}</span>{multiline
    ? <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} rows={3} maxLength={10000} required={required} />
    : <input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} maxLength={500} required={required} />}</label>;
}

const newCharacter = (): Character => ({ id: crypto.randomUUID(), name: '', affiliation: '', english: '', appearance: { hairStyle: '', hairColor: '', eyeColor: '', extra: '' }, variants: [], color: '#a7d8c4', initials: 'MY', favorite: false });
const copyCharacter = (character: Character): Character => structuredClone(character);

export function CharacterManager({ characters, onChange, onClose }: { characters: Character[]; onChange: (characters: Character[]) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Character>(() => characters.length ? copyCharacter(characters[0]) : newCharacter());
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const savedDraft = characters.find(item => item.id === draft.id);
  const dirty = savedDraft ? JSON.stringify(savedDraft) !== JSON.stringify(draft) : Boolean(draft.name || draft.english);
  const filtered = characters.filter(item => `${item.name} ${item.affiliation} ${item.english}`.toLowerCase().includes(query.toLowerCase()));
  function choose(next: Character) {
    if (dirty && (draft.name || draft.english) && !window.confirm('保存していない編集があります。破棄して切り替えますか？')) return;
    setDraft(copyCharacter(next)); setError(''); setStatus('');
  }
  function close() {
    if (dirty && (draft.name || draft.english) && !window.confirm('保存していない編集があります。破棄して閉じますか？')) return;
    onClose();
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) { setError('表示名を入力してください。'); return; }
    if (draft.variants.some(variant => !variant.name.trim())) { setError('差分に名前を付けてください。'); return; }
    const next = { ...draft, name: draft.name.trim(), initials: draft.initials.trim() || draft.name.slice(0, 2) };
    onChange(savedDraft ? characters.map(item => item.id === draft.id ? next : item) : [...characters, next]);
    setDraft(copyCharacter(next)); setError(''); setStatus('キャラクターを保存しました');
  }
  function remove() {
    if (!savedDraft || !window.confirm(`「${draft.name}」を削除しますか？ 保存済みプロンプトの英語は残ります。`)) return;
    const next = characters.filter(item => item.id !== draft.id); onChange(next); setDraft(next[0] ? copyCharacter(next[0]) : newCharacter()); setStatus('削除しました');
  }
  function changeAppearance(key: keyof Character['appearance'], value: string) { setDraft({ ...draft, appearance: { ...draft.appearance, [key]: value } }); setStatus(''); }
  function changeVariant(index: number, patch: Partial<Character['variants'][number]>) {
    setDraft({ ...draft, variants: draft.variants.map((variant, i) => {
      if (i !== index) return variant;
      if (patch.kind && patch.kind !== variant.kind) {
        return { ...variant, ...patch, overrides: {}, english: '' };
      }
      return { ...variant, ...patch };
    }) });
    setStatus('');
  }
  return <Dialog title="キャラクター" subtitle="名前と外見を登録して、いつでも呼び出す。" onClose={close}>
    <div className="manager-layout">
      <aside className="manager-list"><SearchField value={query} onChange={setQuery} placeholder="名前・所属で検索" />
        <button className="button manager-add" onClick={() => choose(newCharacter())}><Plus size={16} />キャラクターを追加</button>
        <div className="manager-list-items">{filtered.map(character => <button className={`manager-item ${draft.id === character.id ? 'active' : ''}`} key={character.id} onClick={() => choose(character)}>
          <span className="mini-avatar" style={{ background: character.color }}>{character.initials}</span><span className="manager-item-copy"><strong>{character.name}</strong><small>{character.affiliation || '所属なし'}</small></span>{character.favorite && <Heart size={14} fill="currentColor" />}
        </button>)}{!filtered.length && <p className="empty-note">キャラクターが見つかりません。</p>}</div>
      </aside>
      <form className="manager-editor" onSubmit={save}>
        <div className="editor-heading"><h3>{savedDraft ? 'キャラクターを編集' : '新しいキャラクター'}</h3><button className={`icon-button ${draft.favorite ? 'is-favorite' : ''}`} aria-label={draft.favorite ? 'お気に入りを解除' : 'お気に入りに追加'} aria-pressed={Boolean(draft.favorite)} type="button" onClick={() => setDraft({ ...draft, favorite: !draft.favorite })}><Heart size={18} fill={draft.favorite ? 'currentColor' : 'none'} /></button></div>
        <div className="field-grid"><Field label="日本語の表示名" value={draft.name} onChange={name => setDraft({ ...draft, name })} required placeholder="例：オリジナルキャラクター" /><Field label="作品・所属" value={draft.affiliation} onChange={affiliation => setDraft({ ...draft, affiliation })} placeholder="例：オリジナル" /></div>
        <Field label="キャラクター名の英語タグ" value={draft.english} onChange={english => setDraft({ ...draft, english })} placeholder="例：original character" />
        <div className="section-divider"><span>基本の外見</span><small>表情・ポーズ・背景はここに含めません</small></div>
        <div className="field-grid"><Field label="髪型（英語）" value={draft.appearance.hairStyle} onChange={value => changeAppearance('hairStyle', value)} placeholder="long hair" /><Field label="髪色（英語）" value={draft.appearance.hairColor} onChange={value => changeAppearance('hairColor', value)} placeholder="black hair" /><Field label="目の色（英語）" value={draft.appearance.eyeColor} onChange={value => changeAppearance('eyeColor', value)} placeholder="blue eyes" /><Field label="その他の外見（英語）" value={draft.appearance.extra} onChange={value => changeAppearance('extra', value)} placeholder="glasses" /></div>
        <div className="section-divider"><span>衣装・髪型の差分</span><button className="button ghost" type="button" onClick={() => setDraft({ ...draft, variants: [...draft.variants, { id: crypto.randomUUID(), name: '', kind: 'outfit', english: '', overrides: {} }] })}><Plus size={14} />差分を追加</button></div>
        {!draft.variants.length && <p className="empty-note">よく使う衣装や髪型を、名前付きで登録できます。</p>}
        {draft.variants.map((variant, index) => <div className="variant-editor" key={variant.id}>
          <div className="variant-editor-head"><input aria-label={`差分${index + 1}の名前`} placeholder="差分の名前" value={variant.name} onChange={event => changeVariant(index, { name: event.target.value })} maxLength={500} /><select aria-label={`差分${index + 1}の種類`} value={variant.kind} onChange={event => changeVariant(index, { kind: event.target.value as 'hair' | 'outfit' })}><option value="outfit">衣装</option><option value="hair">髪型</option></select><button type="button" className="icon-button" aria-label={`差分${index + 1}を削除`} onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, i) => i !== index) })}><X size={16} /></button></div>
          {variant.kind === 'outfit' ? <Field label="衣装の英語" value={variant.english ?? ''} onChange={english => changeVariant(index, { english })} placeholder="white shirt, black skirt" /> : <div className="field-grid"><Field label="置き換える髪型（英語）" value={variant.overrides?.hairStyle ?? ''} onChange={hairStyle => { const overrides = { ...variant.overrides }; if (hairStyle) overrides.hairStyle = hairStyle; else delete overrides.hairStyle; changeVariant(index, { overrides }); }} placeholder="short hair" /><Field label="置き換える髪色（英語）" value={variant.overrides?.hairColor ?? ''} onChange={hairColor => { const overrides = { ...variant.overrides }; if (hairColor) overrides.hairColor = hairColor; else delete overrides.hairColor; changeVariant(index, { overrides }); }} placeholder="black hair" /></div>}
          <small className="muted">{variant.kind === 'outfit' ? '適用時はトップス・ボトムス・衣装セットを置き換えます。' : '入力した項目だけを置換します。未入力の項目は基本設定を引き継ぎます。'}</small>
        </div>)}
        <div className="section-divider"><span>表示設定</span></div>
        <div className="field-grid"><Field label="アイコンの文字" value={draft.initials} onChange={initials => setDraft({ ...draft, initials: initials.slice(0, 3) })} placeholder="MY" /><label className="field"><span>アイコンの色</span><input type="color" value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })} /></label></div>
        {error && <p className="form-error" role="alert">{error}</p>}{status && <p className="form-success" role="status"><Check size={14} />{status}</p>}
        <footer className="editor-actions"><button className="button primary" type="submit"><Check size={16} />保存する</button>{savedDraft && <><button className="button ghost" type="button" onClick={() => { const duplicate = copyCharacter(draft); setDraft({ ...duplicate, id: crypto.randomUUID(), name: `${draft.name} のコピー` }); setStatus('複製を作成しました。保存すると登録されます。'); }}><Copy size={15} />複製</button><button className="icon-button danger" type="button" onClick={remove} aria-label="キャラクターを削除"><Trash2 size={16} /></button></>}</footer>
      </form>
    </div>
  </Dialog>;
}

const newTag = (): Tag => ({ id: crypto.randomUUID(), label: '', english: '', category: 'outfit', group: 'multi:custom' });

export function DictionaryManager({ tags, onChange, onClose, adultMode = false, onImport }: { tags: Tag[]; onChange: (tags: Tag[]) => void; onClose: () => void; adultMode?: boolean; onImport?: () => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const firstTag = tags.find(t => adultMode || !t.mature);
  const [draft, setDraft] = useState<Tag>(() => firstTag ? { ...firstTag } : newTag());
  const [keywordText, setKeywordText] = useState((firstTag?.keywords ?? []).join(', '));
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const original = tags.find(tag => tag.id === draft.id);
  const dirty = (original ? JSON.stringify(original) !== JSON.stringify(draft) : Boolean(draft.label || draft.english)) || keywordText !== (original?.keywords ?? []).join(', ');
  function close() { if (!dirty || window.confirm('保存していない編集があります。破棄して閉じますか？')) onClose(); }
  function choose(next: Tag) { if (dirty && !window.confirm('保存していない編集があります。破棄して切り替えますか？')) return; setDraft({ ...next }); setKeywordText((next.keywords ?? []).join(', ')); setError(''); setStatus(''); }
  function save(event: FormEvent) {
    event.preventDefault();
    const keywords = [...new Set(keywordText.split(/[,、\n]/).map(k => k.trim()).filter(Boolean))];
    if (keywords.length > 30 || keywords.some(k => k.length > 200)) { setError('検索キーワードは30個以内、各200文字以内で入力してください。'); return; }
    const next = { ...draft, label: draft.label.trim(), negative: draft.category === 'negative', keywords };
    if (!next.label || !next.english.trim()) return;
    onChange(original ? tags.map(tag => tag.id === next.id ? next : tag) : [...tags, next]); setDraft(next); setKeywordText(keywords.join(', ')); setError(''); setStatus('辞書に保存しました');
  }
  const filtered = tags.filter(tag => (adultMode || !tag.mature) && (category === 'all' || tag.category === category) && matchesTag(tag, query));
  return <Dialog title="タグ辞書" subtitle="自分が使う表現を、日本語と英語のペアで管理。" onClose={close}>
    <div className="manager-layout">
      <aside className="manager-list"><SearchField value={query} onChange={setQuery} placeholder="日本語・英語で検索" /><select className="manager-category-select" aria-label="辞書のカテゴリで絞り込み" value={category} onChange={event => setCategory(event.target.value)}><option value="all">すべてのカテゴリ</option>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><button className="button manager-add" onClick={() => choose(newTag())}><Plus size={16} />タグを追加</button>{onImport && <button className="button dictionary-import-button" onClick={() => { if (!dirty || window.confirm('未保存の編集を破棄して一括登録を開きますか？')) onImport(); }}><Upload size={14}/>資料から一括登録</button>}<div className="manager-list-items">{filtered.map(tag => <button className={`manager-item ${tag.id === draft.id ? 'active' : ''}`} key={tag.id} onClick={() => choose(tag)}><BookOpen size={16} /><span className="manager-item-copy"><strong>{tag.label}{tag.mature && <span className="mature-manager-badge">18+</span>}</strong><small>{tag.english}</small></span></button>)}{!filtered.length && <p className="empty-note">タグが見つかりません。</p>}</div></aside>
      <form className="manager-editor" onSubmit={save}><div className="editor-heading"><h3>{original ? 'タグを編集' : '新しいタグ'}</h3><span className="small-badge">{tags.filter(t => adultMode || !t.mature).length} tags</span></div><Field label="日本語の表示名" value={draft.label} onChange={label => setDraft({ ...draft, label })} required placeholder="例：白いシャツ" /><Field label="出力する英語" value={draft.english} onChange={english => setDraft({ ...draft, english })} required multiline placeholder="white shirt" /><p className="field-help">括弧・記号・複数フレーズも、入力した内容のまま出力します。</p><label className="field"><span>検索用の別名・キーワード</span><input value={keywordText} onChange={e => setKeywordText(e.target.value)} placeholder="例：シャツ、ワイシャツ、わいしゃつ" maxLength={6000}/></label><div className="dictionary-classification"><label className="checkbox-label"><input type="checkbox" checked={Boolean(draft.mature)} disabled={!adultMode} onChange={e => setDraft({ ...draft, mature: e.target.checked })}/>成人向け辞書に分類</label><small>成人向け辞書をONにしたときだけ、選択画面に表示します。</small></div><label className="field"><span>カテゴリ</span><select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value, group: 'multi:custom' })}>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="field"><span>選択時の扱い</span><select value={draft.group.startsWith('multi:') ? 'multiple' : draft.group} onChange={event => setDraft({ ...draft, group: event.target.value === 'multiple' ? 'multi:custom' : event.target.value })}><option value="multiple">複数選択（ほかのタグを外さない）</option>{[['tops', 'トップスを置き換える'], ['bottoms', 'ボトムスを置き換える'], ['outfit-set', '衣装セットとして置き換える'], ['hair-style', '髪型を置き換える'], ['hair-color', '髪色を置き換える'], ['eye-color', '目の色を置き換える'], ['posture', '姿勢を置き換える'], ['hands', '腕・手の位置を置き換える'], ['expression', '表情を置き換える'], ['gaze', '視線を置き換える'], ['framing', '描写範囲を置き換える'], ['direction', '人物の向きを置き換える'], ['angle', 'カメラ角度を置き換える'], ['place', '主な場所を置き換える']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}{!draft.group.startsWith('multi:') && !['tops', 'bottoms', 'outfit-set', 'hair-style', 'hair-color', 'eye-color', 'posture', 'hands', 'expression', 'gaze', 'framing', 'direction', 'angle', 'place'].includes(draft.group) && <option value={draft.group}>既存のグループ：{tagGroups[draft.group.replace('multi:', '')] ?? draft.group}</option>}</select></label><div className="inline-note"><BookOpen size={17} /><p>辞書を編集しても、保存済みの組み合わせに記録された英語は変更されません。</p></div>{error && <p className="form-error" role="alert">{error}</p>}{status && <p className="form-success" role="status"><Check size={14} />{status}</p>}<footer className="editor-actions"><button className="button primary" type="submit"><Check size={16} />保存する</button>{original && <button className="button ghost danger" type="button" onClick={() => { if (!window.confirm(`「${draft.label}」を辞書から削除しますか？`)) return; const next = tags.filter(tag => tag.id !== draft.id); onChange(next); const first = next.find(t => adultMode || !t.mature); setDraft(first ? { ...first } : newTag()); setKeywordText((first?.keywords ?? []).join(', ')); setError(''); setStatus('削除しました'); }}><Trash2 size={15} />削除</button>}</footer></form>
    </div>
  </Dialog>;
}

export function Library({ saved, onLoad, onDelete, onClose }: { saved: SavedPrompt[]; onLoad: (prompt: SavedPrompt) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const filtered = saved.filter(prompt => `${prompt.name} ${prompt.positive}`.toLowerCase().includes(query.toLowerCase()));
  return <Dialog title="保存したプロンプト" subtitle="うまくいった組み合わせを、もう一度。" onClose={onClose}>
    <div className="library-toolbar"><SearchField value={query} onChange={setQuery} placeholder="名前・プロンプトで検索" /><span className="muted">{saved.length}件保存済み</span></div>
    {!saved.length ? <div className="library-empty"><BookOpen size={36} /><h3>お気に入りの組み合わせを残そう</h3><p>作成画面の「保存」から、選択内容や英語の原文を保存できます。</p><button className="button primary" onClick={onClose}>作成画面へ戻る</button></div> : !filtered.length ? <p className="empty-note">一致するプロンプトがありません。</p> : <div className="library-grid">{filtered.map(prompt => <article className="saved-card" key={prompt.id}><div className="saved-card-heading"><span className="small-badge">{prompt.workspace ? '組み合わせ' : '原文'}</span><small>{new Date(prompt.createdAt).toLocaleDateString('ja-JP')}</small></div><h3>{prompt.name}</h3><p className="saved-prompt-preview">{prompt.positive || 'ポジティブ指定なし'}</p>{prompt.negative && <small className="muted">ネガティブあり</small>}<footer><button className="button ghost" onClick={() => onLoad(prompt)}>呼び出す<ArrowUpRight size={15} /></button><button className="icon-button danger" aria-label={`「${prompt.name}」を削除`} onClick={() => { if (window.confirm(`「${prompt.name}」を削除しますか？`)) onDelete(prompt.id); }}><Trash2 size={15} /></button></footer></article>)}</div>}
  </Dialog>;
}
