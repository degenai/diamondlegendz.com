const RECIPE_ROOT = '/recipe-book';
const RECIPE_PREFIX = `${RECIPE_ROOT}/`;
const LOGIN_PATH = `${RECIPE_PREFIX}login`;
const LIBRARY_PATH = `${RECIPE_PREFIX}api/library`;
const LIBRARY_KEY = 'kathies-kitchen/v1';
const SESSION_COOKIE = 'kathies_session';
const SESSION_SECONDS = 180 * 24 * 60 * 60;
const encoder = new TextEncoder();

function secureHeaders(contentType = 'text/plain; charset=utf-8') {
  return {
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Content-Type': contentType,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}

function loginPage(error = '') {
  const message = error === 'rate'
    ? 'Too many tries. Please wait a minute and try again.'
    : 'That password did not work. Try again.';
  const notice = error ? `<p id="login-error" class="error" role="alert">${message}</p>` : '';
  const title = error ? 'Password didn’t match · Kathie’s Kitchen' : 'Kathie’s Kitchen';
  const inputState = error ? 'aria-invalid="true" aria-describedby="login-error"' : 'autofocus';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 24px; color: #2f241d; background: radial-gradient(circle at 20% 0%, #fffaf0 0, transparent 42%), linear-gradient(145deg, #f3e6d3, #dbc9b5); }
    main { width: min(100%, 430px); padding: clamp(28px, 8vw, 46px); border: 1px solid rgba(103, 70, 47, .18); border-radius: 30px; background: rgba(255, 253, 248, .94); box-shadow: 0 24px 70px rgba(83, 55, 35, .17); }
    .mark { width: 62px; height: 62px; display: grid; place-items: center; margin-bottom: 28px; border-radius: 20px; color: #fffaf1; background: #8f3e2f; font-family: Georgia, serif; font-size: 34px; box-shadow: 0 10px 26px rgba(143, 62, 47, .25); }
    .eyebrow { margin: 0 0 9px; color: #8f3e2f; font-size: .76rem; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
    h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2.35rem, 10vw, 3.45rem); font-weight: 500; line-height: .98; letter-spacing: -.045em; }
    .lede { margin: 18px 0 28px; color: #6d5c50; font-size: 1.02rem; line-height: 1.6; }
    label { display: block; margin-bottom: 9px; font-weight: 750; }
    input { width: 100%; min-height: 54px; padding: 0 16px; border: 2px solid #806a58; border-radius: 14px; background: #fff; color: #2f241d; font: inherit; font-size: 16px; outline: none; }
    input:focus { border-color: #8f3e2f; }
    input:focus-visible { outline: 3px solid #2f241d; outline-offset: 3px; box-shadow: none; }
    button { width: 100%; min-height: 56px; margin-top: 14px; border: 0; border-radius: 14px; color: #fffaf1; background: #8f3e2f; font: inherit; font-weight: 800; cursor: pointer; box-shadow: 0 10px 22px rgba(143, 62, 47, .2); }
    button:hover { background: #783326; }
    button:focus-visible { outline: 3px solid #2f241d; outline-offset: 3px; }
    @media (forced-colors: active) {
      input:focus-visible, button:focus-visible { outline: 3px solid CanvasText; }
    }
    .error { margin: 0 0 18px; padding: 12px 14px; border-radius: 12px; color: #7a241d; background: #f9ddd8; font-weight: 700; }
    .privacy { margin: 22px 0 0; color: #78685d; font-size: .83rem; line-height: 1.5; }
    .privacy strong { color: #4f4138; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">K</div>
    <p class="eyebrow">Private family recipe box</p>
    <h1>Kathie’s Kitchen</h1>
    <p class="lede">Enter the family password. Your cookbook will be ready as soon as the door opens.</p>
    ${notice}
    <form method="post" action="/recipe-book/login">
      <label for="password">Family password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required ${inputState}>
      <button type="submit">Open my cookbook</button>
    </form>
    <p class="privacy"><strong>Private by design.</strong> The family library stays behind this login, then lives locally on this device for fast, offline cooking.</p>
  </main>
</body>
</html>`;
}

function loginResponse(error = '', status = 200, extraHeaders = {}) {
  return new Response(loginPage(error), {
    status,
    headers: { ...secureHeaders('text/html; charset=utf-8'), ...extraHeaders },
  });
}

function unauthorizedResponse() {
  return new Response('Authentication required', {
    status: 401,
    headers: secureHeaders(),
  });
}

async function timingSafeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

function cookieValue(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}

async function hasValidSession(request, env) {
  if (!env.KATHIES_SESSION_SECRET) return false;
  const token = cookieValue(request, SESSION_COOKIE);
  const [expiresRaw, signature] = token.split('.', 2);
  const expires = Number(expiresRaw);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = await sign(expiresRaw, env.KATHIES_SESSION_SECRET);
  return timingSafeEqual(signature, expected);
}

async function readLoginPassword(request, maxBytes = 1_024) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    const error = new Error('Unsupported form body');
    error.code = 'INVALID_FORM';
    throw error;
  }
  const statedLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(statedLength) && statedLength > maxBytes) {
    const error = new Error('Form body is too large');
    error.code = 'BODY_TOO_LARGE';
    throw error;
  }

  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      const error = new Error('Form body is too large');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return String(new URLSearchParams(body).get('password') || '');
}

async function login(request, env) {
  if (!env.KATHIES_PASSWORD || !env.KATHIES_SESSION_SECRET) {
    return new Response('Kitchen access is not configured', { status: 503, headers: secureHeaders() });
  }
  if (!env.LOGIN_RATE_LIMITER?.limit) {
    return new Response('Kitchen access is not configured', { status: 503, headers: secureHeaders() });
  }
  let limit;
  try {
    limit = await env.LOGIN_RATE_LIMITER.limit({
      key: request.headers.get('CF-Connecting-IP') || 'unknown',
    });
  } catch {
    return new Response('Kitchen access is temporarily unavailable', { status: 503, headers: secureHeaders() });
  }
  if (!limit.success) {
    if (request.cf) console.warn('kathies_login_rate_limited', { colo: request.cf.colo || 'unknown' });
    return loginResponse('rate', 429, { 'Retry-After': '60' });
  }
  let password;
  try {
    password = await readLoginPassword(request);
  } catch (error) {
    if (error?.code === 'BODY_TOO_LARGE') {
      return new Response('Request body is too large', { status: 413, headers: secureHeaders() });
    }
    return loginResponse('invalid', 400);
  }
  if (!await timingSafeEqual(password, env.KATHIES_PASSWORD)) {
    if (request.cf) console.warn('kathies_login_failed', { colo: request.cf.colo || 'unknown' });
    return loginResponse('incorrect', 401);
  }

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const signature = await sign(String(expires), env.KATHIES_SESSION_SECRET);
  return new Response(null, {
    status: 303,
    headers: {
      ...secureHeaders(),
      Location: RECIPE_PREFIX,
      'Set-Cookie': `${SESSION_COOKIE}=${expires}.${signature}; Max-Age=${SESSION_SECONDS}; Path=${RECIPE_PREFIX}; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}

async function privateLibrary(request, env) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { ...secureHeaders(), Allow: 'GET' },
    });
  }
  if (!env.RECIPE_LIBRARY?.getWithMetadata) {
    return new Response('Kitchen library is not configured', { status: 503, headers: secureHeaders() });
  }
  let record;
  try {
    record = await env.RECIPE_LIBRARY.getWithMetadata(LIBRARY_KEY, { type: 'stream' });
  } catch {
    return new Response('Kitchen library is unavailable', { status: 503, headers: secureHeaders() });
  }
  const { value, metadata } = record || {};
  if (!value
    || metadata?.schema !== 'kathies-kitchen/v1'
    || !Number.isSafeInteger(metadata.recipeCount)
    || metadata.recipeCount < 1
    || metadata.recipeCount > 5_000
    || !Number.isSafeInteger(metadata.byteLength)
    || metadata.byteLength < 1
    || metadata.byteLength > 25_000_000
    || !/^[a-f0-9]{64}$/.test(metadata.sha256 || '')) {
    return new Response('Kitchen library is unavailable', { status: 503, headers: secureHeaders() });
  }
  return new Response(value, {
    status: 200,
    headers: secureHeaders('application/json; charset=utf-8'),
  });
}

function normalizePathname(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Keep malformed escapes literal so they cannot gain a different asset-path meaning here.
  }
  const trailingSlash = decoded.endsWith('/') || decoded.endsWith('\\');
  const segments = [];
  for (const segment of decoded.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  const normalized = `/${segments.join('/')}`;
  return `${normalized}${trailingSlash && normalized !== '/' ? '/' : ''}`.toLowerCase();
}

function protectedRecipePath(path) {
  return path === RECIPE_ROOT || path.startsWith(RECIPE_PREFIX);
}

function exactRoute(path, route) {
  return path === route || path === `${route}/`;
}

export async function handleSiteRequest(request, env) {
  const url = new URL(request.url);
  const path = normalizePathname(url.pathname);
  if (!protectedRecipePath(path)) return env.ASSETS.fetch(request);
  if (path === RECIPE_ROOT) {
    return new Response(null, {
      status: 302,
      headers: { ...secureHeaders(), Location: RECIPE_PREFIX },
    });
  }
  if (exactRoute(path, LOGIN_PATH)) {
    if (request.method === 'POST') return login(request, env);
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...secureHeaders(), Allow: 'GET, POST' },
      });
    }
    if (await hasValidSession(request, env)) {
      return new Response(null, {
        status: 303,
        headers: { ...secureHeaders(), Location: RECIPE_PREFIX },
      });
    }
    return loginResponse();
  }

  if (!await hasValidSession(request, env)) {
    if (request.method === 'GET' && (path === RECIPE_PREFIX || path === `${RECIPE_PREFIX}index.html`)) {
      return loginResponse();
    }
    return unauthorizedResponse();
  }

  if (exactRoute(path, LIBRARY_PATH)) return privateLibrary(request, env);
  return env.ASSETS.fetch(request);
}
