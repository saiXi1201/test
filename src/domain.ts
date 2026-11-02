import { seedCharacters, seedTags } from './seed'

export interface Category { id: string; label: string; icon: string; description: string }
export interface Tag { id: string; label: string; english: string; category: string; group: string; negative?: boolean; keywords?: string[]; mature?: boolean }
export interface Appearance { hairStyle: string; hairColor: string; eyeColor: string; extra: string }
export interface CharacterVariant { id: string; name: string; kind: 'hair' | 'outfit'; overrides: Partial<Appearance>; english?: string }
export interface Character { id: string; name: string; affiliation: string; english: string; appearance: Appearance; variants: CharacterVariant[]; color: string; initials: string; favorite?: boolean }
export interface Workspace { characterId: string | null; hairVariantId: string | null; outfitVariantId: string | null; selectedIds: string[]; adultMode?: boolean; suppressedBlockIds?: string[]; positiveExtra: string; negativeExtra: string; quality: boolean; editedPositive: string | null; editedNegative: string | null }
export interface SavedPrompt { id: string; name: string; positive: string; negative: string; createdAt: string; workspace?: Workspace }
export interface AppData { schemaVersion: 1; catalogVersion?: number; hiddenTagIds?: string[]; characters: Character[]; tags: Tag[]; saved: SavedPrompt[]; workspace: Workspace }
export interface PromptBlock { id: string; label: string; english: string; source: 'character' | 'variant' | 'tag' | 'quality' | 'extra'; negative: boolean; category: string }
export interface BuiltPrompt { positive: string; negative: string; blocks: PromptBlock[] }

export const CATALOG_VERSION = 2
export const QUALITY = '(masterpiece, best quality, highres, detailed shading)'
export const emptyWorkspace: Workspace = { characterId: null, hairVariantId: null, outfitVariantId: null, selectedIds: [], adultMode: false, suppressedBlockIds: [], positiveExtra: '', negativeExtra: '', quality: false, editedPositive: null, editedNegative: null }
const categoryOrder = ['appearance', 'outfit', 'pose', 'expression', 'composition', 'background', 'lighting', 'style', 'negative']

export function createInitialData(): AppData {
  return structuredClone({ schemaVersion: 1, catalogVersion: CATALOG_VERSION, hiddenTagIds: [], characters: seedCharacters, tags: seedTags, saved: [], workspace: emptyWorkspace })
}

/** Add bundled entries once per catalog version without replacing user edits or archives. */
export function upgradeCatalog(original: AppData): { data: AppData; added: number } {
  const data = structuredClone(original)
  if ((data.catalogVersion ?? 0) >= CATALOG_VERSION) return { data, added: 0 }
  const hidden = new Set(data.hiddenTagIds ?? [])
  const existing = new Set(data.tags.map(tag => tag.id))
  if (data.catalogVersion === undefined) {
    // Version 1's original catalog used unprefixed IDs. Missing originals were
    // deleted by the user; expansion entries have stable ext-/mature- IDs.
    for (const tag of seedTags) {
      if (!tag.id.startsWith('ext-') && !tag.id.startsWith('mature-') && !existing.has(tag.id)) hidden.add(tag.id)
    }
  }
  const additions = seedTags.filter(tag => !existing.has(tag.id) && !hidden.has(tag.id))
  data.tags.push(...structuredClone(additions))
  data.hiddenTagIds = [...hidden]
  data.catalogVersion = CATALOG_VERSION
  return { data, added: additions.length }
}

/** Mode controls structured dictionary entries only; free text remains byte-identical. */
export function setAdultMode(workspace: Workspace, enabled: boolean, tags: Tag[]): Workspace {
  const matureIds = new Set(tags.filter(tag => tag.mature).map(tag => tag.id))
  return {
    ...workspace,
    adultMode: enabled,
    selectedIds: enabled ? [...workspace.selectedIds] : workspace.selectedIds.filter(id => !matureIds.has(id)),
  }
}

/** Never splits user text: weighted groups and compound phrases remain intact. */
export function buildPrompt(workspace: Workspace, characters: Character[], tags: Tag[]): BuiltPrompt {
  const blocks: PromptBlock[] = []
  const add = (block: PromptBlock) => { if (block.english.trim() && !workspace.suppressedBlockIds?.includes(block.id)) blocks.push(block) }
  const selected = tags.filter(tag => workspace.selectedIds.includes(tag.id) && (!tag.mature || workspace.adultMode === true))
  if (workspace.quality) add({ id: 'quality', label: '品質セット', english: QUALITY, source: 'quality', negative: false, category: 'style' })
  const character = characters.find(item => item.id === workspace.characterId)
  if (character) {
    add({ id: 'character', label: character.name, english: character.english, source: 'character', negative: false, category: 'appearance' })
    const hairVariant = character.variants.find(variant => variant.id === workspace.hairVariantId && variant.kind === 'hair')
    const appearance = { ...character.appearance, ...hairVariant?.overrides }
    const labels: Record<keyof Appearance, string> = { hairStyle: '髪型', hairColor: '髪色', eyeColor: '目の色', extra: '基本外見' }
    const groups: Record<keyof Appearance, string> = { hairStyle: 'hair-style', hairColor: 'hair-color', eyeColor: 'eye-color', extra: 'appearance-extra' }
    for (const key of Object.keys(labels) as (keyof Appearance)[]) {
      // A selected structured option overrides only its matching base appearance field.
      if (selected.some(tag => !tag.negative && tag.group === groups[key])) continue
      const fromVariant = Boolean(hairVariant && key in hairVariant.overrides)
      add({ id: `character-${key}`, label: fromVariant ? `${hairVariant!.name}・${labels[key]}` : `${character.name}・${labels[key]}`, english: appearance[key], source: fromVariant ? 'variant' : 'character', negative: false, category: 'appearance' })
    }
    const outfit = character.variants.find(variant => variant.id === workspace.outfitVariantId && variant.kind === 'outfit')
    const hasManualOutfit = selected.some(tag => !tag.negative && ['tops', 'bottoms', 'outfit-set'].includes(tag.group))
    if (outfit && !hasManualOutfit) add({ id: 'variant-outfit', label: outfit.name, english: outfit.english || '', source: 'variant', negative: false, category: 'outfit' })
  }
  selected.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)).forEach(tag => {
    add({ id: tag.id, label: tag.label, english: tag.english, source: 'tag', negative: Boolean(tag.negative), category: tag.category })
  })
  add({ id: 'positive-extra', label: '自由入力', english: workspace.positiveExtra, source: 'extra', negative: false, category: 'extra' })
  add({ id: 'negative-extra', label: '自由入力（ネガティブ）', english: workspace.negativeExtra, source: 'extra', negative: true, category: 'negative' })
  return { positive: blocks.filter(block => !block.negative).map(block => block.english).join(', '), negative: blocks.filter(block => block.negative).map(block => block.english).join(', '), blocks }
}

function conflict(a: Tag, b: Tag): boolean {
  if (Boolean(a.negative) !== Boolean(b.negative)) return false
  if (a.group.startsWith('multi:') || b.group.startsWith('multi:')) return false
  if (a.group === b.group) return true
  return (a.group === 'outfit-set' && ['tops', 'bottoms'].includes(b.group)) || (b.group === 'outfit-set' && ['tops', 'bottoms'].includes(a.group))
}

export function toggleTag(workspace: Workspace, tag: Tag, tags: Tag[]): Workspace {
  if (workspace.selectedIds.includes(tag.id)) return { ...workspace, selectedIds: workspace.selectedIds.filter(id => id !== tag.id) }
  if (tag.mature && workspace.adultMode !== true) return workspace
  const selectedIds = workspace.selectedIds.filter(id => {
    const previous = tags.find(item => item.id === id)
    return previous ? !conflict(tag, previous) : false
  })
  selectedIds.push(tag.id)
  const clearOutfit = !tag.negative && ['tops', 'bottoms', 'outfit-set'].includes(tag.group)
  return { ...workspace, selectedIds, ...(clearOutfit ? { outfitVariantId: null } : {}) }
}

// Backup validation is intentionally explicit: malformed input must never replace stored data.
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function str(value: unknown, max = 100000): value is string { return typeof value === 'string' && value.length <= max }
function id(value: unknown): value is string { return str(value, 200) && value.length > 0 }
function nullableId(value: unknown): value is string | null { return value === null || id(value) }
function optionalText(value: unknown): boolean { return value === null || str(value) }
function validSuppressed(value: unknown): boolean { return value === undefined || (Array.isArray(value) && value.length <= 1000 && value.every(id) && new Set(value).size === value.length) }
function validIdList(value: unknown, max: number): value is string[] { return Array.isArray(value) && value.length <= max && value.every(id) && new Set(value).size === value.length }
function validKeywords(value: unknown): boolean { return value === undefined || (Array.isArray(value) && value.length <= 30 && value.every(word => str(word, 200))) }
function validWorkspace(value: unknown): value is Workspace {
  return object(value) && nullableId(value.characterId) && nullableId(value.hairVariantId) && nullableId(value.outfitVariantId) && Array.isArray(value.selectedIds) && value.selectedIds.length <= 10000 && value.selectedIds.every(id) && new Set(value.selectedIds).size === value.selectedIds.length && validSuppressed(value.suppressedBlockIds) && str(value.positiveExtra) && str(value.negativeExtra) && typeof value.quality === 'boolean' && (value.adultMode === undefined || typeof value.adultMode === 'boolean') && optionalText(value.editedPositive) && optionalText(value.editedNegative)
}
function validAppearance(value: unknown, partial = false): boolean {
  return object(value) && Object.keys(value).every(key => ['hairStyle', 'hairColor', 'eyeColor', 'extra'].includes(key) && str(value[key])) && (partial || ['hairStyle', 'hairColor', 'eyeColor', 'extra'].every(key => str(value[key])))
}
function uniqueIds(items: Record<string, unknown>[]): boolean { return new Set(items.map(item => item.id)).size === items.length }
export function validateBackup(value: unknown): AppData {
  const fail = () => { throw new Error('バックアップの形式が正しくないか、未対応のバージョンです。現在のデータは変更されていません。') }
  if (!object(value) || value.schemaVersion !== 1 || (value.catalogVersion !== undefined && (!Number.isInteger(value.catalogVersion) || Number(value.catalogVersion) < 1 || Number(value.catalogVersion) > CATALOG_VERSION)) || (value.hiddenTagIds !== undefined && !validIdList(value.hiddenTagIds, 20000)) || !Array.isArray(value.characters) || value.characters.length > 5000 || !Array.isArray(value.tags) || value.tags.length > 20000 || !Array.isArray(value.saved) || value.saved.length > 10000 || !validWorkspace(value.workspace)) return fail()
  for (const item of value.characters) {
    if (!object(item) || !id(item.id) || !str(item.name, 500) || !str(item.affiliation, 500) || !str(item.english) || !validAppearance(item.appearance) || !str(item.color, 100) || !str(item.initials, 30) || (item.favorite !== undefined && typeof item.favorite !== 'boolean') || !Array.isArray(item.variants) || item.variants.length > 1000) return fail()
    for (const variant of item.variants) {
      if (!object(variant) || !id(variant.id) || !str(variant.name, 500) || !['hair', 'outfit'].includes(String(variant.kind)) || !validAppearance(variant.overrides, true) || (variant.english !== undefined && !str(variant.english))) return fail()
    }
    if (!uniqueIds(item.variants)) return fail()
  }
  for (const tag of value.tags) {
    if (!object(tag) || !id(tag.id) || !str(tag.label, 500) || !str(tag.english) || !categoryOrder.includes(String(tag.category)) || !id(tag.group) || (tag.negative !== undefined && typeof tag.negative !== 'boolean') || !validKeywords(tag.keywords) || (tag.mature !== undefined && typeof tag.mature !== 'boolean')) return fail()
  }
  for (const saved of value.saved) {
    if (!object(saved) || !id(saved.id) || !str(saved.name, 500) || !str(saved.positive) || !str(saved.negative) || !str(saved.createdAt, 100) || !Number.isFinite(Date.parse(saved.createdAt)) || (saved.workspace !== undefined && !validWorkspace(saved.workspace))) return fail()
  }
  if (!uniqueIds(value.characters) || !uniqueIds(value.tags) || !uniqueIds(value.saved)) return fail()
  const workspace = value.workspace
  const characterIds = new Set(value.characters.map(item => item.id))
  const tagIds = new Set(value.tags.map(item => item.id))
  // Archived compositions intentionally retain stale IDs; their final strings remain usable.
  if (workspace.characterId !== null && !characterIds.has(workspace.characterId)) return fail()
  if (workspace.selectedIds.some(selected => !tagIds.has(selected))) return fail()
  const character = value.characters.find(item => item.id === workspace.characterId)
  for (const [field, kind] of [['hairVariantId', 'hair'], ['outfitVariantId', 'outfit']] as const) {
    const variantId = workspace[field]
    if (variantId !== null && (!character || !character.variants.some((variant: CharacterVariant) => variant.id === variantId && variant.kind === kind))) return fail()
  }
  return structuredClone(value) as unknown as AppData
}
