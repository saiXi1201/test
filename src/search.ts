import type { Tag } from './domain';

export function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function matchesTag(tag: Tag, query: string): boolean {
  const haystack = normalizeSearch([tag.label, tag.english, ...(tag.keywords ?? [])].join(' '));
  return normalizeSearch(query).trim().split(/\s+/).filter(Boolean).every(term => haystack.includes(term));
}
