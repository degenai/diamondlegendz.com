// Headless Chrome over CDP for the Jev tools (pilot.mjs, replay-test.mjs): the bones of the older
// scratchpad lib.mjs. Launches Chrome muted and headless on a throwaway profile (mkdtemp under
// JEV_TMP, else the OS temp dir) that is deleted on exit, even on a crash or Ctrl-C. Optional
// `meta` is written to localStorage before the game boots (a fixed profile for a replay).
// Env: CHROME (path to chrome), JEV_TMP (profile parent dir).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openGame(url, { port = 9735, meta = null, width = 1280, height = 720 } = {}) {
  const prof = mkdtempSync(join(process.env.JEV_TMP || tmpdir(), 'jev-prof-'));
  const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', `--remote-debugging-port=${port}`, `--window-size=${width},${height}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run', `--user-data-dir=${prof}`, 'about:blank']);
  let closed = false;
  const wipe = () => { try { chrome.kill(); } catch {} for (let i = 0; i < 3; i++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch {} } };
  process.once('exit', wipe);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { wipe(); process.exit(130); });

  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); } }
  if (!targets) { wipe(); throw new Error(`Chrome did not open CDP on port ${port}`); }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const logs = []; const S = { errors: 0 };
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
    if (d.method === 'Runtime.consoleAPICalled') {
      const t = d.params.type, txt = d.params.args.map((a) => a.value ?? a.description).join(' ');
      logs.push(`[${t}] ${txt}`); if (t === 'error') S.errors++;
    } else if (d.method === 'Runtime.exceptionThrown') {
      S.errors++; logs.push('[exception] ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    } else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') { S.errors++; logs.push(`[log:error] ${d.params.entry.text} ${d.params.entry.url || ''}`); }
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(`in page: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
    return r.result?.result?.value;
  };
  const J = async (expr) => { const v = await ev(`Promise.resolve(${expr}).then((v) => JSON.stringify(v))`); return v === undefined ? undefined : JSON.parse(v); };   // awaits a promise
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  if (meta) await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('cmf.meta.v1', ${JSON.stringify(JSON.stringify(meta))}); } catch (e) {}` });
  await send('Page.navigate', { url });
  for (let i = 0; i < 120 && (await ev('typeof (window.CMF && window.CMF.agent)').catch(() => '')) !== 'object'; i++) await sleep(250);
  if ((await ev('typeof (window.CMF && window.CMF.agent)')) !== 'object') { wipe(); throw new Error(`the game did not boot at ${url} (is the server up?)\n${logs.slice(0, 10).join('\n')}`); }
  const close = async () => {
    if (closed) return; closed = true;
    try { ws.close(); } catch {}
    const gone = new Promise((r) => chrome.once('exit', r));
    try { chrome.kill(); } catch {}
    await Promise.race([gone, sleep(3000)]);
    for (let i = 0; i < 20; i++) { try { rmSync(prof, { recursive: true, force: true }); break; } catch { await sleep(250); } }
  };
  return { ev, J, send, logs, S, close, sleep };
}
