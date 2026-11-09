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
  for (const f of ['app.js', 'views.js', 'lib.js']) {
    const imports = [...read(f).matchAll(/from '(\.\/[^']+)'/g)].map((m) => m[1]);
    assert.ok(imports.length, f);
    for (const spec of imports) assert.ok(spec.endsWith(tag), `${f}: ${spec}`);
  }
});
test('style.css is well-formed (braces nest and balance)', () => {
  const css = read('style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  for (const [i, c] of [...css].entries()) {
    if (c === '{') depth++;
    if (c === '}') depth--;
    assert.ok(depth >= 0, `unexpected "}" near: ${css.slice(Math.max(0, i - 60), i + 1).trim()}`);
  }
  assert.equal(depth, 0, 'every "{" is closed');
});
test('every app module is in the service worker shell', () => {
  const sw = read('sw.js');
  for (const f of ['app.js', 'lib.js', 'views.js', 'i18n.js']) assert.ok(sw.includes(`'${f}'`), f);
});
