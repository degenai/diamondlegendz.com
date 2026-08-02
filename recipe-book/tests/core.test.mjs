import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import * as core from '../lib/core.mjs';
import { estimateMinutes, mergeRecipes, selectRecipes, shouldRequestWakeLock } from '../lib/core.mjs';
import { gzipSync, strToU8, zipSync } from '../lib/fflate.mjs';
import { parseRecipeArchive, parseRecipeFile, unzipCompatible } from '../lib/importers.mjs';

test('re-importing the same source record updates it without creating a duplicate', () => {
  const first = {
    sourceKey: 'nyt:chicken-piccata',
    title: 'Chicken Piccata',
    source: { kind: 'nyt-index', label: 'NYT Cooking' },
    rating: 5,
    ratingCount: '15.1k',
  };
  const refreshed = {
    ...first,
    ratingCount: '15.2k',
    importedAt: '2026-08-02T12:00:00.000Z',
  };

  const merged = mergeRecipes([first], [refreshed]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].ratingCount, '15.2k');
  assert.equal(merged[0].title, 'Chicken Piccata');
});

test('search and source filters return only matching recipes without mutating the library', () => {
  const library = [
    {
      sourceKey: 'paprika:1',
      title: 'Lemon Chicken',
      author: 'Kathie',
      ingredients: ['2 lemons', 'chicken breast'],
      tags: ['Dinner', 'Quick'],
      source: { kind: 'paprika', label: 'Paprika' },
    },
    {
      sourceKey: 'nyt:1',
      title: 'Classic Lemon Tart',
      author: 'Melissa Clark',
      ingredients: [],
      tags: ['Dessert'],
      source: { kind: 'nyt-index', label: 'NYT Cooking' },
    },
  ];

  const result = selectRecipes(library, { query: 'melissa', source: 'nyt-index' });

  assert.deepEqual(result.map((recipe) => recipe.title), ['Classic Lemon Tart']);
  assert.equal(library.length, 2);
});

test('Recipe Keeper zip imports a complete local recipe with provenance', async () => {
  const bytes = await readFile(new URL('./fixtures/recipe-keeper-fixture.zip', import.meta.url));

  const recipes = await parseRecipeArchive(bytes, 'recipe-keeper-fixture.zip');

  assert.equal(recipes.length, 1);
  assert.deepEqual(recipes[0].ingredients, ['2 lemons', '4 chicken breasts']);
  assert.deepEqual(recipes[0].directions, ['Season the chicken.', 'Roast until done.']);
  assert.equal(recipes[0].source.kind, 'recipe-keeper');
  assert.equal(recipes[0].source.originalUrl, 'https://example.com/lemon-chicken');
  assert.equal(recipes[0].image.path, 'rk-1.jpg');
});

test('Paprika archive imports gzipped recipe records with categories and provenance', async () => {
  const bytes = await readFile(new URL('./fixtures/paprika-fixture.paprikarecipes', import.meta.url));

  const recipes = await parseRecipeArchive(bytes, 'paprika-fixture.paprikarecipes');

  assert.equal(recipes.length, 1);
  assert.equal(recipes[0].sourceKey, 'paprika:pap-1');
  assert.deepEqual(recipes[0].tags, ['Dinner', 'Quick']);
  assert.deepEqual(recipes[0].ingredients, ['1 onion', '4 cups stock']);
  assert.deepEqual(recipes[0].directions, ['Dice onion.', 'Simmer together.']);
  assert.equal(recipes[0].source.kind, 'paprika');
  assert.equal(recipes[0].access, 'full');
});

test('Kathies Kitchen JSON imports external index cards and preserves provenance', async () => {
  const document = {
    schema: 'kathies-kitchen/v1',
    recipes: [{
      sourceKey: 'nyt:chicken-piccata',
      title: 'Chicken Piccata',
      author: 'Ali Slagle',
      source: { kind: 'nyt-index', label: 'NYT Cooking', originalUrl: 'https://cooking.nytimes.com/search?q=Chicken%20Piccata' },
      ingredients: [],
      directions: [],
      tags: ['NYT saved'],
      access: 'external',
      provenance: { capture: 'screenshot', image: 'example.jpg' },
    }],
  };

  const recipes = await parseRecipeFile(new TextEncoder().encode(JSON.stringify(document)), 'kathie-nyt-index.json');

  assert.equal(recipes.length, 1);
  assert.equal(recipes[0].sourceKey, 'nyt:chicken-piccata');
  assert.equal(recipes[0].provenance.image, 'example.jpg');
  assert.equal(recipes[0].access, 'external');
});

test('Quick filtering understands imported minute and fractional-hour time text', () => {
  const recipes = [
    { sourceKey: 'a', title: 'Tostones', totalTime: '10 min', source: { kind: 'nyt-index' } },
    { sourceKey: 'b', title: 'Chicken Piccata', totalTime: '25 min', source: { kind: 'nyt-index' } },
    { sourceKey: 'c', title: 'Lemon Tart', totalTime: '1 1/2 hr', source: { kind: 'recipe-keeper' } },
    { sourceKey: 'd', title: 'Apple Crisp', prepTime: '30 min', cookTime: '50 min', source: { kind: 'paprika' } },
  ];

  assert.equal(estimateMinutes('1 1/2 hr'), 90);
  assert.equal(estimateMinutes('PT1H30M'), 90);
  assert.equal(estimateMinutes('PT10M'), 10);
  assert.deepEqual(selectRecipes(recipes, { filter: 'quick' }).map((recipe) => recipe.title), ['Tostones', 'Chicken Piccata']);
});

test('hybrid ZIP64 entries are read at their real bounded size', async () => {
  const bytes = await readFile(new URL('./fixtures/recipe-keeper-zip64-fixture.zip', import.meta.url));
  const files = unzipCompatible(bytes);

  assert.equal(files['recipes.html'].length, 219);
  assert.match(new TextDecoder().decode(files['recipes.html']), /ZIP64 Lemon Tart/);
});

test('archive importers discard executable source URLs', async () => {
  const keeperHtml = `
    <div class="recipe-details">
      <meta itemprop="recipeId" content="unsafe-rk">
      <h1 itemprop="name">Unsafe Keeper Link</h1>
      <div itemprop="recipeSource"><a href="javascript:globalThis.__recipeXss = true">Bad link</a></div>
    </div>`;
  const keeperArchive = zipSync({ 'recipes.html': strToU8(keeperHtml) });
  const paprikaPayload = {
    uid: 'unsafe-paprika',
    name: 'Unsafe Paprika Link',
    source_url: 'data:text/html,<script>globalThis.__recipeXss=true</script>',
  };
  const paprikaArchive = zipSync({
    'unsafe.paprikarecipe': gzipSync(strToU8(JSON.stringify(paprikaPayload))),
  });

  const [keeper] = await parseRecipeArchive(keeperArchive, 'unsafe.zip');
  const [paprika] = await parseRecipeArchive(paprikaArchive, 'unsafe.paprikarecipes');

  assert.equal(keeper.source.originalUrl, '');
  assert.equal(paprika.source.originalUrl, '');
});

test('Paprika import keeps embedded photos local and discards remote image URLs', async () => {
  const remoteArchive = zipSync({
    'remote.paprikarecipe': gzipSync(strToU8(JSON.stringify({
      uid: 'remote-photo',
      name: 'Remote Photo',
      photo_url: 'https://tracking.example/photo.jpg',
    }))),
  });
  const embeddedArchive = zipSync({
    'embedded.paprikarecipe': gzipSync(strToU8(JSON.stringify({
      uid: 'embedded-photo',
      name: 'Embedded Photo',
      photo_data: 'aGVsbG8=',
    }))),
  });

  const [remote] = await parseRecipeArchive(remoteArchive, 'remote.paprikarecipes');
  const [embedded] = await parseRecipeArchive(embeddedArchive, 'embedded.paprikarecipes');

  assert.equal(remote.image, null);
  assert.equal(embedded.image.dataUrl, 'data:image/jpeg;base64,aGVsbG8=');
});

test('re-import preserves user-owned favorite and recently-added fields', () => {
  const existing = [{
    sourceKey: 'paprika:owned',
    title: 'Owned fields',
    favorite: true,
    importedAt: '2026-07-01T12:00:00.000Z',
  }];
  const incoming = [{
    sourceKey: 'paprika:owned',
    title: 'Updated title',
    favorite: false,
    importedAt: '2026-08-02T12:00:00.000Z',
  }];

  const [merged] = mergeRecipes(existing, incoming);

  assert.equal(merged.title, 'Updated title');
  assert.equal(merged.favorite, true);
  assert.equal(merged.importedAt, '2026-07-01T12:00:00.000Z');
});

test('sorting recipes works without Array.prototype.toSorted', () => {
  assert.equal(typeof core.sortRecipes, 'function');
  const recipes = [
    { title: 'Slow', totalTime: '2 hr', importedAt: '2026-08-01' },
    { title: 'Fast', totalTime: '15 min', importedAt: '2026-07-01' },
  ];

  assert.deepEqual(core.sortRecipes(recipes, 'quickest').map((recipe) => recipe.title), ['Fast', 'Slow']);
  assert.deepEqual(recipes.map((recipe) => recipe.title), ['Slow', 'Fast']);
});

test('backup object URLs are revoked after the download turn', () => {
  assert.equal(typeof core.deferObjectUrlRevoke, 'function');
  let queued;
  let revoked = '';

  core.deferObjectUrlRevoke('blob:test', (url) => { revoked = url; }, (callback) => { queued = callback; });

  assert.equal(revoked, '');
  assert.equal(typeof queued, 'function');
  queued();
  assert.equal(revoked, 'blob:test');
});

test('service workers register on HTTPS and loopback preview hosts', () => {
  assert.equal(typeof core.canRegisterServiceWorker, 'function');
  const allowed = ['https://example.com', 'http://localhost', 'http://127.0.0.1', 'http://[::1]'];
  for (const href of allowed) assert.equal(core.canRegisterServiceWorker(new URL(href)), true);
  assert.equal(core.canRegisterServiceWorker(new URL('http://example.com')), false);
});

test('failed save does not apply in-memory state', async () => {
  let applied = false;

  await assert.rejects(
    core.saveThenApply(
      [{ sourceKey: 'manual:safe', title: 'Safe state' }],
      async () => { throw new Error('quota exceeded'); },
      () => { applied = true; },
    ),
    /quota exceeded/,
  );

  assert.equal(applied, false);
});

test('backup restore preserves imported dates and skips untitled records', async () => {
  const backup = {
    schema: 'kathies-kitchen/v1',
    recipes: [
      {
        sourceKey: 'manual:dated',
        title: 'Dated recipe',
        importedAt: '2026-07-29T18:00:00.000Z',
        source: { kind: 'manual', label: 'Family kitchen' },
      },
      { sourceKey: 'manual:untitled', title: '   ' },
    ],
  };

  const recipes = await parseRecipeFile(strToU8(JSON.stringify(backup)), 'backup.json');

  assert.equal(recipes.length, 1);
  assert.equal(recipes[0].importedAt, '2026-07-29T18:00:00.000Z');
});

test('malformed numeric entities do not abort a Recipe Keeper import', async () => {
  const keeperHtml = `
    <div class="recipe-details">
      <meta itemprop="recipeId" content="malformed-entity">
      <h1 itemprop="name">Malformed &#xFFFFFFFF; title</h1>
    </div>`;
  const archive = zipSync({ 'recipes.html': strToU8(keeperHtml) });

  const [recipe] = await parseRecipeArchive(archive, 'malformed.zip');

  assert.match(recipe.title, /^Malformed/);
});

test('Paprika imports keep unique keys across archives when non-Latin titles lack ids', async () => {
  const firstArchive = zipSync({
    'recipe.paprikarecipe': gzipSync(strToU8(JSON.stringify({
      name: '红烧肉',
      ingredients: 'pork',
      directions: 'Braise.',
    }))),
  });
  const secondArchive = zipSync({
    'recipe.paprikarecipe': gzipSync(strToU8(JSON.stringify({
      name: '红烧肉',
      ingredients: 'tofu',
      directions: 'Simmer.',
    }))),
  });

  const [first] = await parseRecipeArchive(firstArchive, 'first.paprikarecipes');
  const [second] = await parseRecipeArchive(secondArchive, 'second.paprikarecipes');

  assert.notEqual(first.sourceKey, second.sourceKey);
});

test('wake lock is requested only for a visible open cook-mode dialog', () => {
  assert.equal(shouldRequestWakeLock('visible', true, true), true);
  assert.equal(shouldRequestWakeLock('hidden', true, true), false);
  assert.equal(shouldRequestWakeLock('visible', false, true), false);
  assert.equal(shouldRequestWakeLock('visible', true, false), false);
});

test('database exposes a single-recipe persistence path for favorite toggles', async () => {
  const database = await import('../lib/db.mjs');
  assert.equal(typeof database.saveRecipe, 'function');
});

test('database migration reads the aggregate record shape written by v1', async () => {
  const { legacyRecipesFromRecord } = await import('../lib/db.mjs');
  const recipes = [{ sourceKey: 'legacy:one', title: 'Legacy One' }];

  assert.deepEqual(legacyRecipesFromRecord({ key: 'recipes', value: recipes }), recipes);
  assert.deepEqual(legacyRecipesFromRecord(undefined), []);
});

test('HTML blocks remote images and skips to an always-visible focus target', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /img-src 'self' data:/);
  assert.doesNotMatch(html, /img-src[^;]*(?:https:|blob:)/);
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
});
