import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('recipe detail establishes a bounded height chain for touch scrolling', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(
    styles,
    /\.recipe-dialog\s*>\s*#recipe-detail\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*\}/s,
    'the detail mount must fill the clipped dialog so .detail-shell can become the scroll container',
  );
  assert.match(
    styles,
    /@media\s*\(max-width:\s*760px\)[\s\S]*?\.detail-shell\s*\{[^}]*overflow-y:\s*auto;[^}]*\}/,
    'the mobile detail shell must own vertical scrolling',
  );
});
