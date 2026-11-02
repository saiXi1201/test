import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Keep the standard Vite build and additionally produce a portable, offline HTML.
const dist = resolve('dist');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)];
for (const match of scripts) {
  const script = await readFile(resolve(dist, match[1].replace(/^\//, '')), 'utf8');
  html = html.replace(match[0], () => `<script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script>`);
}
const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)];
for (const match of styles) {
  const css = await readFile(resolve(dist, match[1].replace(/^\//, '')), 'utf8');
  html = html.replace(match[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
}
await writeFile(resolve(dist, 'iroha-prototype.html'), html);
console.log('Portable prototype: dist/iroha-prototype.html');
