import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, CATALOG_VERSION, createInitialData, emptyWorkspace, setAdultMode, toggleTag, upgradeCatalog, validateBackup } from './domain'
import { seedCharacters, seedTags } from './seed'
import type { Tag } from './domain'

test('new workspace is empty; no quality, character or expression is inferred', () => {
  assert.deepEqual(buildPrompt(emptyWorkspace, seedCharacters, seedTags), { positive: '', negative: '', blocks: [] })
})
test('hair variant replaces only the specified field', () => {
  const result = buildPrompt({ ...emptyWorkspace, characterId: 'azki', hairVariantId: 'azki-ponytail' }, seedCharacters, seedTags)
  assert.match(result.positive, /ponytail, black hair, pink eyes/)
  assert.ok(!result.positive.includes('long hair'))
  assert.ok(!result.positive.includes('smile'))
})
test('manual appearance overrides the matching base field without deleting others', () => {
  const result = buildPrompt({ ...emptyWorkspace, characterId: 'azki', selectedIds: ['short-hair'] }, seedCharacters, seedTags)
  assert.ok(result.positive.includes('short hair'))
  assert.ok(!result.positive.includes('long hair'))
  assert.ok(result.positive.includes('black hair'))
})
test('removing an inherited appearance field preserves all other base fields', () => {
  const result = buildPrompt({ ...emptyWorkspace, characterId: 'azki', suppressedBlockIds: ['character-hairStyle'] }, seedCharacters, seedTags)
  assert.ok(!result.positive.includes('long hair'))
  assert.ok(result.positive.includes('black hair'))
  assert.ok(result.positive.includes('pink eyes'))
  assert.ok(result.positive.includes('AZKi'))
})
test('single-choice groups replace each other and same item toggles off', () => {
  const tag = seedTags.find(item => item.id === 'black-shirt')!
  const next = toggleTag({ ...emptyWorkspace, selectedIds: ['white-shirt', 'black-skirt'] }, tag, seedTags)
  assert.deepEqual(next.selectedIds, ['black-skirt', 'black-shirt'])
  assert.deepEqual(toggleTag(next, tag, seedTags).selectedIds, ['black-skirt'])
})
test('outfit sets replace separates while shoes and multi-select accessories remain', () => {
  const next = toggleTag({ ...emptyWorkspace, selectedIds: ['white-shirt', 'black-skirt', 'boots', 'ribbon'] }, seedTags.find(item => item.id === 'white-dress')!, seedTags)
  assert.deepEqual(next.selectedIds, ['boots', 'ribbon', 'white-dress'])
})
test('negative output is separate and raw weighted phrases stay byte-identical', () => {
  const raw = '(white shirt:1.2), AZKi \\(hololive\\)\n  custom phrase'
  const result = buildPrompt({ ...emptyWorkspace, positiveExtra: raw, negativeExtra: '(blurry:1.3)', selectedIds: ['bad-hands'] }, seedCharacters, seedTags)
  assert.equal(result.positive, raw)
  assert.equal(result.negative, 'bad hands, (blurry:1.3)')
})
test('generation does not overwrite or substitute a manual edit', () => {
  const result = buildPrompt({ ...emptyWorkspace, selectedIds: ['smile'], editedPositive: 'my handwritten prompt' }, seedCharacters, seedTags)
  assert.equal(result.positive, 'smile')
})
test('valid backup is independently cloned and malformed backup is rejected', () => {
  const original = createInitialData()
  const restored = validateBackup(original)
  restored.characters[0].name = 'Changed'
  assert.notEqual(restored.characters[0].name, original.characters[0].name)
  assert.throws(() => validateBackup({ ...original, schemaVersion: 2 }))
  assert.throws(() => validateBackup({ ...original, workspace: { ...original.workspace, selectedIds: ['missing-id'] } }))
  assert.throws(() => validateBackup({ ...original, tags: [...original.tags, original.tags[0]] }))
})
test('backup rejects orphaned or incorrectly typed variant references and duplicate suppression IDs', () => {
  const original = createInitialData()
  assert.throws(() => validateBackup({ ...original, workspace: { ...original.workspace, hairVariantId: 'azki-ponytail' } }))
  assert.throws(() => validateBackup({ ...original, workspace: { ...original.workspace, characterId: 'azki', hairVariantId: 'azki-casual' } }))
  assert.throws(() => validateBackup({ ...original, workspace: { ...original.workspace, characterId: 'deleted' } }))
  assert.throws(() => validateBackup({ ...original, workspace: { ...original.workspace, suppressedBlockIds: ['character', 'character'] } }))
})
test('saved raw text and archived workspace survive backup round trip without normalization', () => {
  const original = createInitialData()
  const raw = '(masterpiece, best quality),\nAZKi \\(hololive\\),,  custom phrase  '
  original.saved.push({ id: 'raw-1', name: '成功した原文', positive: raw, negative: '(blurry:1.2)\n', createdAt: '2026-11-02T00:00:00.000Z', workspace: { ...emptyWorkspace, characterId: 'deleted-character', selectedIds: ['deleted-tag'] } })
  const restored = validateBackup(JSON.parse(JSON.stringify(original)))
  assert.equal(restored.saved[0].positive, raw)
  assert.equal(restored.saved[0].negative, '(blurry:1.2)\n')
  assert.equal(restored.saved[0].workspace?.characterId, 'deleted-character')
})


test('legacy catalog upgrade adds expansion without changing edits, deleted original tags, or saved raw text', () => {
  const original = createInitialData()
  delete original.catalogVersion
  delete original.hiddenTagIds
  original.tags = original.tags.filter(tag => !tag.id.startsWith('ext-') && !tag.id.startsWith('mature-') && tag.id !== 'white-shirt')
  original.tags.find(tag => tag.id === 'black-shirt')!.english = '(my custom shirt:1.3)'
  original.tags.push({ id: 'custom-1', label: '独自項目', english: 'custom phrase', category: 'style', group: 'multi:custom' })
  original.workspace = { ...emptyWorkspace, selectedIds: ['black-shirt'], positiveExtra: '  (keep this:1.2)\n' }
  original.saved.push({ id: 'archive-1', name: '保存原文', positive: '(original:1.1),,  text  ', negative: '  blurry\n', createdAt: '2026-11-02T00:00:00.000Z' })
  const unchanged = structuredClone(original)
  const upgraded = upgradeCatalog(original)
  assert.deepEqual(original, unchanged)
  assert.equal(upgraded.data.catalogVersion, CATALOG_VERSION)
  assert.equal(upgraded.data.tags.find(tag => tag.id === 'black-shirt')!.english, '(my custom shirt:1.3)')
  assert.ok(upgraded.data.tags.some(tag => tag.id === 'custom-1'))
  assert.ok(!upgraded.data.tags.some(tag => tag.id === 'white-shirt'))
  assert.ok(upgraded.data.hiddenTagIds?.includes('white-shirt'))
  assert.deepEqual(upgraded.data.characters, original.characters)
  assert.deepEqual(upgraded.data.saved, original.saved)
  assert.deepEqual(upgraded.data.workspace, original.workspace)
  const expansionCount = seedTags.filter(tag => tag.id.startsWith('ext-') || tag.id.startsWith('mature-')).length
  assert.equal(upgraded.added, expansionCount)
  assert.equal(upgraded.data.tags.length, original.tags.length + expansionCount)
  assert.deepEqual(validateBackup(upgraded.data), upgraded.data)
})

test('catalog tombstones are respected and a current-version upgrade never resurrects removed entries', () => {
  const original = createInitialData()
  original.catalogVersion = 1
  original.tags = original.tags.filter(tag => !['white-shirt', 'black-shirt'].includes(tag.id))
  original.hiddenTagIds = ['white-shirt']
  const first = upgradeCatalog(original)
  assert.equal(first.added, 1)
  assert.ok(!first.data.tags.some(tag => tag.id === 'white-shirt'))
  assert.ok(first.data.tags.some(tag => tag.id === 'black-shirt'))
  const second = upgradeCatalog(first.data)
  assert.equal(second.added, 0)
  assert.deepEqual(second.data, first.data)
  first.data.tags = first.data.tags.filter(tag => tag.id !== 'black-shirt')
  const third = upgradeCatalog(first.data)
  assert.equal(third.added, 0)
  assert.ok(!third.data.tags.some(tag => tag.id === 'black-shirt'))
})

const adultFashion: Tag = { id: 'test-adult-fashion', label: '成人向け衣装テスト', english: 'adult fashion', category: 'outfit', group: 'outfit-set', mature: true, keywords: ['成人衣装'] }

test('adult dictionary options require explicit mode and injected IDs do not enter generated output', () => {
  const tags = [...seedTags, adultFashion]
  assert.equal(emptyWorkspace.adultMode, false)
  assert.deepEqual(toggleTag(emptyWorkspace, adultFashion, tags), emptyWorkspace)
  const injected = { ...emptyWorkspace, selectedIds: ['white-shirt', adultFashion.id] }
  assert.equal(buildPrompt(injected, seedCharacters, tags).positive, 'white shirt')
  const enabled = setAdultMode(emptyWorkspace, true, tags)
  const selected = toggleTag(enabled, adultFashion, tags)
  assert.deepEqual(selected.selectedIds, [adultFashion.id])
  assert.equal(buildPrompt(selected, seedCharacters, tags).positive, adultFashion.english)
  assert.equal(buildPrompt({ ...selected, adultMode: false }, seedCharacters, tags).positive, '')
})

test('turning adult mode off removes adult selections while preserving user text and ordinary selections', () => {
  const tags = [...seedTags, adultFashion]
  const original = { ...emptyWorkspace, adultMode: true, selectedIds: ['boots', adultFashion.id], positiveExtra: '  custom phrase\n', negativeExtra: '(blurry:1.1)  ', editedPositive: '(keep original:1.2),,  ', editedNegative: '  handwritten\n' }
  const disabled = setAdultMode(original, false, tags)
  assert.equal(disabled.adultMode, false)
  assert.deepEqual(disabled.selectedIds, ['boots'])
  assert.equal(disabled.positiveExtra, original.positiveExtra)
  assert.equal(disabled.negativeExtra, original.negativeExtra)
  assert.equal(disabled.editedPositive, original.editedPositive)
  assert.equal(disabled.editedNegative, original.editedNegative)
  assert.deepEqual(original.selectedIds, ['boots', adultFashion.id])
  const reenabled = setAdultMode(disabled, true, tags)
  assert.deepEqual(reenabled.selectedIds, ['boots'])
})

test('legacy backups without new optional fields remain compatible without implicit catalog changes', () => {
  const original = createInitialData()
  delete original.catalogVersion
  delete original.hiddenTagIds
  delete original.workspace.adultMode
  original.tags = original.tags.slice(0, 2)
  const restored = validateBackup(original)
  assert.deepEqual(restored, original)
  assert.equal(restored.tags.length, 2)
  assert.equal(restored.catalogVersion, undefined)
})

test('backup validates catalog version, tombstones, search keywords, and mode metadata', () => {
  const original = createInitialData()
  original.tags.push(adultFashion)
  assert.deepEqual(validateBackup(original), original)
  const invalid: unknown[] = [
    { ...original, catalogVersion: CATALOG_VERSION + 1 },
    { ...original, catalogVersion: 1.5 },
    { ...original, catalogVersion: 0 },
    { ...original, hiddenTagIds: ['duplicate', 'duplicate'] },
    { ...original, hiddenTagIds: [12] },
    { ...original, tags: [{ ...adultFashion, keywords: [true] }] },
    { ...original, tags: [{ ...adultFashion, keywords: ['x'.repeat(201)] }] },
    { ...original, tags: [{ ...adultFashion, keywords: Array(31).fill('word') }] },
    { ...original, tags: [{ ...adultFashion, mature: 'yes' }] },
    { ...original, workspace: { ...original.workspace, adultMode: 'yes' } },
  ]
  for (const item of invalid) assert.throws(() => validateBackup(item))
})
