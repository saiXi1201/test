import { BookOpen, Check, ChevronDown, Eye, SlidersHorizontal } from 'lucide-react';

export type CatalogScope = 'all' | 'selected' | 'mature';

interface Props {
  adultMode: boolean;
  onAdultModeChange: (value: boolean) => void;
  total: number;
  matureCount: number;
  scope: CatalogScope;
  onScopeChange: (scope: CatalogScope) => void;
  groups: { value: string; label: string }[];
  group: string;
  onGroupChange: (value: string) => void;
  selectedCount: number;
}

export function CatalogMode({ adultMode, onAdultModeChange, total, matureCount }: Pick<Props, 'adultMode' | 'onAdultModeChange' | 'total' | 'matureCount'>) {
  return <div className={`catalog-mode ${adultMode ? 'adult-enabled' : ''}`}>
    <div className="catalog-summary"><BookOpen size={16}/><div><strong>イラスト用タグ辞書</strong><span>{total.toLocaleString()} タグ収録 · 9カテゴリ</span></div></div>
    <div className="adult-mode-control"><div><strong>成人向け辞書</strong><small>{adultMode ? `ON · ${matureCount} タグ追加表示` : 'NSFW / 別表示'}</small></div><button className={`switch ${adultMode ? 'on' : ''}`} role="switch" aria-label="成人向け辞書" aria-checked={adultMode} onClick={() => onAdultModeChange(!adultMode)}><span/></button></div>
    {adultMode && <p className="adult-mode-note"><Eye size={13}/>18歳以上の人物向けの項目を表示しています。選んだタグだけを出力します。</p>}
  </div>;
}

export function CatalogFilters({ adultMode, scope, onScopeChange, groups, group, onGroupChange, selectedCount }: Pick<Props, 'adultMode' | 'scope' | 'onScopeChange' | 'groups' | 'group' | 'onGroupChange' | 'selectedCount'>) {
  return <div className="catalog-filters">
    <div className="catalog-scopes" aria-label="タグの表示対象">
      <button aria-pressed={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => onScopeChange('all')}>すべて</button>
      <button aria-pressed={scope === 'selected'} className={scope === 'selected' ? 'active' : ''} onClick={() => onScopeChange('selected')}><Check size={12}/>選択済み <span>{selectedCount}</span></button>
      {adultMode && <button aria-pressed={scope === 'mature'} className={scope === 'mature' ? 'active mature-scope' : 'mature-scope'} onClick={() => onScopeChange('mature')}>成人向けのみ</button>}
    </div>
    <label className="catalog-group-filter"><SlidersHorizontal size={13}/><select aria-label="タグの種類で絞り込み" value={group} onChange={e => onGroupChange(e.target.value)}><option value="all">すべての種類</option>{groups.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select><ChevronDown size={12}/></label>
  </div>;
}
