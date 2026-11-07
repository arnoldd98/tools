// Every script/stylesheet URL carries ?v=<sw.js VERSION>, so a browser holding an older
// version's files in its HTTP cache can never pair a new page with old scripts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const VERSION = /const VERSION = '([^']+)'/.exec(read('sw.js'))[1];
const tag = `?v=${encodeURIComponent(VERSION)}`;

test('index.html links app.js and style.css with the current version', () => {
  const html = read('index.html');
  assert.ok(html.includes(`<script type="module" src="app.js${tag}">`), 'app.js tag');
  assert.ok(html.includes(`<link rel="stylesheet" href="style.css${tag}">`), 'style.css tag');
});
test('module imports carry the current version', () => {
  for (const f of ['app.js', 'views.js']) {
    const imports = [...read(f).matchAll(/from '(\.\/[^']+)'/g)].map((m) => m[1]);
    assert.ok(imports.length, f);
    for (const spec of imports) assert.ok(spec.endsWith(tag), `${f}: ${spec}`);
  }
});
test('light matcha look only: no dark-mode palette, matcha accent', () => {
  const css = read('style.css');
  assert.ok(!css.includes('prefers-color-scheme: dark'), 'no dark palette');
  assert.match(css, /--accent: #6e8c4f/);
  assert.match(css, /--bg: #f6f3ea/);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.background_color, '#f6f3ea');
  assert.equal(manifest.theme_color, '#f6f3ea');
});
