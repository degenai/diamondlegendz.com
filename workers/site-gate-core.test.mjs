import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { handleSiteRequest } from './site-gate-core.mjs';

function env(overrides = {}) {
  return {
    KATHIES_PASSWORD: 'correct horse battery staple',
    KATHIES_SESSION_SECRET: 'test-session-secret-at-least-32-characters',
    ASSETS: { fetch: async () => new Response('asset', { status: 200 }) },
    LOGIN_RATE_LIMITER: { limit: async () => ({ success: true }) },
    RECIPE_LIBRARY: { getWithMetadata: async () => ({ value: null, metadata: null }) },
    ...overrides,
  };
}

async function loginCookie(environment = env()) {
  const response = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: environment.KATHIES_PASSWORD }),
    }),
    environment,
  );
  return response.headers.get('Set-Cookie').split(';', 1)[0];
}

test('an unauthenticated recipe-book navigation receives the password page without touching static assets', async () => {
  let assetFetches = 0;
  const response = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/'),
    env({ ASSETS: { fetch: async () => { assetFetches += 1; return new Response('asset'); } } }),
  );

  assert.equal(response.status, 200);
  assert.match(await response.text(), /Enter the family password/);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'/);
  assert.match(response.headers.get('Content-Security-Policy'), /form-action 'self'/);
  assert.equal(assetFetches, 0);
});

test('a correct password creates a signed HttpOnly session that grants access to recipe assets', async () => {
  const login = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'correct horse battery staple' }),
    }),
    env(),
  );

  assert.equal(login.status, 303);
  assert.equal(login.headers.get('Location'), '/recipe-book/');
  const setCookie = login.headers.get('Set-Cookie');
  assert.match(setCookie, /^kathies_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\/recipe-book\//);

  const cookie = setCookie.split(';', 1)[0];
  const asset = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/app.mjs', { headers: { Cookie: cookie } }),
    env({ ASSETS: { fetch: async () => new Response('private asset') } }),
  );

  assert.equal(asset.status, 200);
  assert.equal(await asset.text(), 'private asset');
});

test('wrong passwords, missing secrets, and forged cookies fail closed', async () => {
  const wrong = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'wrong' }),
    }),
    env(),
  );
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('Set-Cookie'), null);
  const wrongPage = await wrong.text();
  assert.match(wrongPage, /<title>Password didn’t match · Kathie’s Kitchen<\/title>/);
  assert.match(wrongPage, /id="login-error"/);
  assert.match(wrongPage, /aria-invalid="true"/);
  assert.match(wrongPage, /aria-describedby="login-error"/);
  assert.doesNotMatch(wrongPage, /required autofocus/);

  const unconfigured = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'correct horse battery staple' }),
    }),
    env({ KATHIES_PASSWORD: '' }),
  );
  assert.equal(unconfigured.status, 503);

  let assetFetches = 0;
  const forged = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/app.mjs', {
      headers: { Cookie: 'kathies_session=4102444800.forged' },
    }),
    env({ ASSETS: { fetch: async () => { assetFetches += 1; return new Response('leak'); } } }),
  );
  assert.equal(forged.status, 401);
  assert.equal(assetFetches, 0);
});

test('GET login always provides a usable retry page and redirects an authenticated browser', async () => {
  const environment = env();
  const retry = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login'),
    environment,
  );
  assert.equal(retry.status, 200);
  assert.match(await retry.text(), /Family password/);

  const trailingSlash = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login/'),
    environment,
  );
  assert.equal(trailingSlash.status, 200);
  assert.match(await trailingSlash.text(), /Family password/);

  const cookie = await loginCookie(environment);
  const authenticated = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login', { headers: { Cookie: cookie } }),
    environment,
  );
  assert.equal(authenticated.status, 303);
  assert.equal(authenticated.headers.get('Location'), '/recipe-book/');
});

test('login attempts are edge-rate-limited and a missing limiter fails closed', async () => {
  const request = () => new Request('https://diamondlegendz.com/recipe-book/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '203.0.113.7' },
    body: new URLSearchParams({ password: 'wrong' }),
  });
  let key;
  const limited = await handleSiteRequest(request(), env({
    LOGIN_RATE_LIMITER: {
      limit: async (input) => { key = input.key; return { success: false }; },
    },
  }));
  assert.equal(key, '203.0.113.7');
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.match(await limited.text(), /wait a minute/i);

  const unbound = await handleSiteRequest(request(), env({ LOGIN_RATE_LIMITER: null }));
  assert.equal(unbound.status, 503);
});

test('oversized login bodies are rejected before password parsing', async () => {
  const response = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `password=${'x'.repeat(2_048)}`,
    }),
    env(),
  );
  assert.equal(response.status, 413);
  assert.equal(response.headers.get('Set-Cookie'), null);
});

test('canonical recipe-book spellings cannot bypass the gate', async () => {
  for (const path of [
    '/recipe-book',
    '/recipe-book%2Fapi/library',
    '/recipe-book%5Capi%5Clibrary',
    '/%72ecipe-book/app.mjs',
    '//recipe-book/app.mjs',
    '/RECIPE-BOOK/app.mjs',
  ]) {
    let assetFetches = 0;
    const response = await handleSiteRequest(
      new Request(`https://diamondlegendz.com${path}`),
      env({ ASSETS: { fetch: async () => { assetFetches += 1; return new Response('leak'); } } }),
    );
    assert.notEqual(response.status, 200, path);
    assert.equal(assetFetches, 0, path);
  }
});

test('unrelated public site paths continue to pass through unchanged', async () => {
  const response = await handleSiteRequest(
    new Request('https://diamondlegendz.com/pokemon-zodiac/'),
    env({ ASSETS: { fetch: async (request) => new Response(new URL(request.url).pathname) } }),
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '/pokemon-zodiac/');
});

test('the authenticated private-library endpoint reads the cookbook from KV without exposing it as an asset', async () => {
  const library = JSON.stringify({ schema: 'kathies-kitchen/v1', recipes: [{ sourceKey: 'test:one', title: 'Mom’s recipe' }] });
  const environment = env({
    RECIPE_LIBRARY: {
      getWithMetadata: async (key, options) => {
        assert.equal(key, 'kathies-kitchen/v1');
        assert.deepEqual(options, { type: 'stream' });
        return {
          value: new Response(library).body,
          metadata: {
            schema: 'kathies-kitchen/v1',
            recipeCount: 1,
            byteLength: new TextEncoder().encode(library).byteLength,
            sha256: 'a'.repeat(64),
          },
        };
      },
    },
    ASSETS: { fetch: async () => { throw new Error('private data must not reach static assets'); } },
  });
  const cookie = await loginCookie(environment);
  const response = await handleSiteRequest(
    new Request('https://diamondlegendz.com/RECIPE-BOOK/API/LIBRARY', { headers: { Cookie: cookie } }),
    environment,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), JSON.parse(library));
});

test('the private-library endpoint fails closed when KV metadata is malformed', async () => {
  const environment = env({
    RECIPE_LIBRARY: {
      getWithMetadata: async () => ({
        value: new Response('{"recipes":"not-an-array"}').body,
        metadata: { schema: 'wrong', recipeCount: 129, byteLength: 26, sha256: 'bad' },
      }),
    },
  });
  const cookie = await loginCookie(environment);
  const response = await handleSiteRequest(
    new Request('https://diamondlegendz.com/recipe-book/api/library', { headers: { Cookie: cookie } }),
    environment,
  );

  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /not-an-array/);
});

test('the deployable Worker entrypoint exposes the tested site handler', async () => {
  const { default: worker } = await import('./site-gate.mjs');
  assert.equal(typeof worker.fetch, 'function');
});

test('Wrangler runs the password gate before every static asset and binds private storage plus rate limiting', async () => {
  const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.main, 'workers/site-gate.mjs');
  assert.equal(config.compatibility_date, '2026-08-02');
  assert.equal(config.assets.binding, 'ASSETS');
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.kv_namespaces?.[0]?.binding, 'RECIPE_LIBRARY');
  assert.match(config.kv_namespaces?.[0]?.id || '', /^[a-f0-9]{32}$/);
  assert.equal(config.ratelimits?.[0]?.name, 'LOGIN_RATE_LIMITER');
  assert.equal(config.ratelimits?.[0]?.simple?.limit, 5);
  assert.equal(config.ratelimits?.[0]?.simple?.period, 60);
  assert.equal(config.observability?.logs?.enabled, true);
});

test('the route guard is canonical and the password boundary has high-contrast focus', async () => {
  const source = await readFile(new URL('./site-gate-core.mjs', import.meta.url), 'utf8');
  assert.match(source, /decodeURIComponent\(pathname\)/);
  assert.match(source, /\.replace\(\/\\\\\/g, '\/'\)/);
  assert.doesNotMatch(source, /toLocaleLowerCase/);
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/);
  assert.doesNotMatch(source, /left\.length !== right\.length/);
  assert.match(source, /border: 2px solid #806a58/);
  assert.match(source, /input:focus-visible \{[^}]*outline: 3px solid #2f241d/);
  assert.match(source, /button:focus-visible \{[^}]*outline: 3px solid #2f241d/);
  assert.match(source, /@media \(forced-colors: active\)/);
});
