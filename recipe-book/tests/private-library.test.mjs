import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { isLegacySampleLibrary, seedPrivateLibrary, shouldUseSamplePreview } from '../lib/private-library.mjs';
import { reconcilePrivateSeed } from '../lib/db.mjs';

const freshDevice = { seedStateReader: async () => null };

test('a fresh browser fetches, parses, and saves the private family library automatically', async () => {
  const parsed = [
    { sourceKey: 'family:one', title: 'First family recipe' },
    { sourceKey: 'family:two', title: 'Second family recipe' },
  ];
  let saved;
  const result = await seedPrivateLibrary([], {
    ...freshDevice,
    fetcher: async (url, options) => {
      assert.equal(url, './api/library');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.credentials, 'same-origin');
      return new Response('{"private":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    parser: async (bytes, fileName) => {
      assert.equal(new TextDecoder().decode(bytes), '{"private":true}');
      assert.equal(fileName, 'kathies-private-library.json');
      return parsed;
    },
    merger: (current, incoming) => [...current, ...incoming],
    saver: async (recipes) => { saved = recipes; },
    now: () => '2026-08-02T20:00:00.000Z',
  });

  assert.equal(result.seeded, true);
  assert.equal(result.added, 2);
  assert.deepEqual(result.recipes, saved);
  assert.deepEqual(result.recipes.map((recipe) => recipe.importedAt), [
    '2026-08-02T20:00:00.000Z',
    '2026-08-02T20:00:00.000Z',
  ]);
});

test('an already-populated device does not redownload or overwrite its local cookbook', async () => {
  const current = [{ sourceKey: 'family:favorite', title: 'Mom’s favorite', favorite: true }];
  const result = await seedPrivateLibrary(current, {
    fetcher: async () => { throw new Error('should not fetch'); },
    saver: async () => { throw new Error('should not save'); },
  });

  assert.equal(result.seeded, false);
  assert.equal(result.added, 0);
  assert.equal(result.recipes, current);
});

test('an old sample-only library is replaced by the private cookbook automatically', async () => {
  const samples = [
    { sourceKey: 'sample:sunday-lemon-chicken', title: 'Sunday Lemon Chicken', source: { kind: 'sample' } },
    { sourceKey: 'sample:crispy-potato-tray', title: 'Crispy Potato Tray', source: { kind: 'sample' } },
  ];
  const family = [{ sourceKey: 'family:one', title: 'Family One' }];
  let saveOptions;
  const result = await seedPrivateLibrary(samples, {
    ...freshDevice,
    fetcher: async () => new Response('{}'),
    parser: async () => family,
    saver: async (recipes, options) => {
      saveOptions = options;
      return { recipes, saved: true, added: recipes.length };
    },
  });

  assert.equal(isLegacySampleLibrary(samples), true);
  assert.equal(isLegacySampleLibrary([...samples, family[0]]), false);
  assert.equal(saveOptions.replaceLegacySamples, true);
  assert.deepEqual(result.recipes.map((recipe) => recipe.sourceKey), ['family:one']);
});

test('an expired login stops before parsing and signals that authentication is required', async () => {
  await assert.rejects(
    seedPrivateLibrary([], {
    ...freshDevice,
      fetcher: async () => new Response('Authentication required', { status: 401 }),
      parser: async () => { throw new Error('must not parse an unauthorized response'); },
      saver: async () => { throw new Error('must not save'); },
    }),
    (error) => error?.code === 'AUTH_REQUIRED',
  );
});

test('network failures become a friendly private-library error', async () => {
  await assert.rejects(
    seedPrivateLibrary([], {
    ...freshDevice,
      fetcher: async () => { throw new TypeError('Failed to fetch'); },
      parser: async () => { throw new Error('must not parse'); },
      saver: async () => { throw new Error('must not save'); },
    }),
    (error) => error?.code === 'LIBRARY_UNAVAILABLE'
      && error.message === 'Check your connection and try again.',
  );
});

test('interrupted library downloads become an actionable retry error', async () => {
  await assert.rejects(
    seedPrivateLibrary([], {
    ...freshDevice,
      fetcher: async () => ({
        status: 200,
        ok: true,
        arrayBuffer: async () => { throw new TypeError('network stream error'); },
      }),
    }),
    (error) => error?.code === 'LIBRARY_UNAVAILABLE'
      && error.message === 'The family cookbook download was interrupted. Please try again.',
  );
});

test('parser and local-save failures become actionable first-run errors', async () => {
  await assert.rejects(
    seedPrivateLibrary([], {
    ...freshDevice,
      fetcher: async () => new Response('{}'),
      parser: async () => { throw new SyntaxError('Unexpected token <'); },
    }),
    (error) => error?.code === 'LIBRARY_INVALID'
      && error.message === 'The family cookbook could not be read. Please try again.',
  );

  await assert.rejects(
    seedPrivateLibrary([], {
    ...freshDevice,
      fetcher: async () => new Response('{}'),
      parser: async () => [{ sourceKey: 'family:one', title: 'One' }],
      saver: async () => { throw new Error('QuotaExceededError'); },
    }),
    (error) => error?.code === 'STORAGE_UNAVAILABLE'
      && error.message === 'This browser could not save the cookbook. Check its storage and try again.',
  );
});

test('the success count reports recipes that actually survive merge de-duplication', async () => {
  const result = await seedPrivateLibrary([], {
    ...freshDevice,
    fetcher: async () => new Response('{}'),
    parser: async () => [
      { sourceKey: 'family:one', title: 'One' },
      { sourceKey: 'family:one', title: 'One duplicate' },
    ],
    merger: (_current, incoming) => [incoming[0]],
    saver: async () => {},
  });
  assert.equal(result.added, 1);
});

test('a deliberately erased device stays empty without redownloading the family corpus', async () => {
  const result = await seedPrivateLibrary([], {
    seedStateReader: async () => 'suppressed',
    fetcher: async () => { throw new Error('must not fetch after an intentional erase'); },
    saver: async () => { throw new Error('must not save after an intentional erase'); },
  });

  assert.deepEqual(result, { recipes: [], seeded: false, added: 0 });
});

test('the seed transaction preserves a concurrent import and yields to a concurrent erase', async () => {
  const family = [{ sourceKey: 'family:one', title: 'Family One' }];
  const manual = [{ sourceKey: 'manual:one', title: 'Manual One', favorite: true }];
  assert.deepEqual(reconcilePrivateSeed(manual, family, null), {
    recipes: [...family, ...manual],
    saved: true,
    added: 1,
  });
  assert.deepEqual(reconcilePrivateSeed(manual, family, 'suppressed'), {
    recipes: manual,
    saved: false,
    added: 0,
  });
});

test('sample migration removes old demos but preserves a real recipe imported during download', () => {
  const samples = [{ sourceKey: 'sample:one', title: 'Sample One', source: { kind: 'sample' } }];
  const family = [{ sourceKey: 'family:one', title: 'Family One' }];
  const manual = [{ sourceKey: 'manual:one', title: 'Manual One', favorite: true }];

  assert.deepEqual(reconcilePrivateSeed([...samples, ...manual], family, null, { replaceLegacySamples: true }), {
    recipes: [...family, ...manual],
    saved: true,
    added: 1,
  });
  assert.deepEqual(reconcilePrivateSeed(samples, family, 'suppressed', { replaceLegacySamples: true }), {
    recipes: samples,
    saved: false,
    added: 0,
  });
});

test('an erase that wins during the download prevents the seed result from repopulating memory', async () => {
  const result = await seedPrivateLibrary([], {
    ...freshDevice,
    fetcher: async () => new Response('{}'),
    parser: async () => [{ sourceKey: 'family:one', title: 'Family One' }],
    saver: async () => ({ recipes: [], saved: false, added: 0 }),
  });
  assert.deepEqual(result, { recipes: [], seeded: false, added: 0 });
});

test('a stalled first-run download times out with an actionable retry error', async () => {
  await assert.rejects(
    seedPrivateLibrary([], {
      ...freshDevice,
      timeoutMs: 5,
      fetcher: async (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }),
    }),
    (error) => error?.code === 'LIBRARY_TIMEOUT'
      && error.message === 'The family cookbook is taking too long to load. Please try again.',
  );
});

test('a slow download that keeps making progress is not aborted by a total wall-clock limit', async () => {
  const result = await seedPrivateLibrary([], {
    ...freshDevice,
    timeoutMs: 25,
    fetcher: async (_url, { signal }) => new Response(new ReadableStream({
      start(controller) {
        const timers = [
          setTimeout(() => controller.enqueue(new TextEncoder().encode('{')), 15),
          setTimeout(() => controller.enqueue(new TextEncoder().encode('}')), 30),
          setTimeout(() => controller.close(), 45),
        ];
        signal.addEventListener('abort', () => {
          timers.forEach(clearTimeout);
          controller.error(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      },
    })),
    parser: async () => [{ sourceKey: 'family:slow', title: 'Slow but steady' }],
    saver: async () => {},
  });
  assert.equal(result.seeded, true);
  assert.equal(result.added, 1);
});

test('sample preview is local-only and cannot suppress production seeding', () => {
  assert.equal(shouldUseSamplePreview(new URL('https://diamondlegendz.com/recipe-book/?preview=samples')), false);
  assert.equal(shouldUseSamplePreview(new URL('http://localhost:8787/recipe-book/')), false);
  assert.equal(shouldUseSamplePreview(new URL('http://localhost:8787/recipe-book/?preview=samples')), true);
  assert.equal(shouldUseSamplePreview(new URL('http://127.0.0.1:8787/recipe-book/?preview=samples')), true);
});

test('the production app renders an accessible first-run status before seeding and supports retry', async () => {
  const [app, html, database] = await Promise.all([
    readFile(new URL('../app.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../lib/db.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /import \{ isLegacySampleLibrary, seedPrivateLibrary, shouldUseSamplePreview \} from '\.\/lib\/private-library\.mjs';/);
  assert.match(app, /shouldUseSamplePreview\(location\)/);
  assert.match(app, /state\.recipes\.length && !isLegacySampleLibrary\(state\.recipes\)/);
  assert.match(app, /state\.seeding = true;[\s\S]*?render\(\);[\s\S]*?await seedPrivateLibrary\(state\.recipes\)/);
  assert.match(app, /seedRetry\.addEventListener\('click'/);
  assert.match(app, /openImport\.disabled = state\.seeding/);
  assert.match(app, /eraseLibrary\.disabled = state\.seeding/);
  assert.match(app, /location\.replace\('\.\/login'\)/);
  assert.match(app, /catch \(error\)[\s\S]*?state\.storageError = true;[\s\S]*?state\.seedError = error\?\.message/);
  assert.match(app, /state\.storageError \? 'Reload cookbook' : 'Try again'/);
  assert.doesNotMatch(app, /AUTH_REQUIRED'\) location\.reload\(\)/);
  assert.match(html, /id="seed-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="seed-retry"/);
  assert.match(html, /rel="manifest"[^>]*crossorigin="use-credentials"/);
  assert.match(html, /id="load-samples"[^>]*hidden/);
  assert.match(app, /loadSamples\.hidden = !shouldUseSamplePreview\(location\)/);
  assert.match(app, /if \(!useSamplePreview && \(!state\.recipes\.length \|\| isLegacySampleLibrary\(state\.recipes\)\)\) await loadPrivateLibrary\(\)/);
  assert.match(database, /const DB_VERSION = 3;/);
  assert.match(database, /const META_STORE = 'metadata';/);
  assert.match(database, /PRIVATE_SEED_SUPPRESSED/);
  assert.match(database, /reconcilePrivateSeed\(existingRecipes, recipes, seedRecord\?\.value/);
  assert.match(database, /if \(result\.saved\) \{\s*recipesStore\.clear\(\);\s*for \(const recipe of result\.recipes\) recipesStore\.put\(recipe\)/);
});

test('the service worker caches the seed code but never intercepts the private API', async () => {
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(worker, /kathies-kitchen-shell-v13/);
  assert.match(worker, /'\.\/lib\/private-library\.mjs'/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(worker, /keys\.filter\(\(key\) => key !== CACHE_NAME\).*caches\.delete\(key\)/);
  assert.match(worker, /new URL\('api\/', self\.registration\.scope\)/);
  assert.match(worker, /url\.pathname\.toLowerCase\(\)\.startsWith\(privateApiPath\)/);
});
