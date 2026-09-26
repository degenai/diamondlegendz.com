// The pilot's decision makers, one interface: makeModel(spec) -> { name, decide(obs) } where obs is
// CMF.agent.observe() ({ text, options: {id: line}, state, tick }) and decide resolves to
// { action, probs?, danger?, ms }. Keys come from the environment only and never touch the repo;
// a model whose key is missing refuses to start with a message that says what to set.
//   oracle          no model: reads the open call from the observation and answers it right (the
//                   harness proof while no key is at hand); in the run, oracle-run.mjs's rules.
// JEV_BASE_URL and ANTHROPIC_BASE_URL, when set, replace the hosts (a proxy, or a local test double).
//   jev             TypeSafe System One. TYPESAFE_API_KEY -> https://api.typesafe.ai/v1/systemone with
//                   model JEV_MODEL (default pinned 'jev-1.13.0'); or, with only AI_GATEWAY_API_KEY,
//                   the Vercel AI Gateway https://ai-gateway.vercel.sh/typesafe/v1/systemone with
//                   model 'typesafe-ai/jev'.
//   claude          Anthropic Messages API, ANTHROPIC_API_KEY, model CLAUDE_MODEL (default
//                   claude-haiku-4-5-20251001), a JSON-only reply {action, danger}.
//   openai:<model>  any OpenAI chat-completions endpoint: PILOT_OPENAI_BASE_URL (default
//                   https://inference-api.nousresearch.com/v1) and PILOT_OPENAI_API_KEY, same prompt.
//
// TypeSafe request / response (docs.typesafe.ai/api.md, fetched 2026-09-25):
//   POST https://api.typesafe.ai/v1/systemone
//   Authorization: Bearer <API_KEY>, Content-Type: application/json
//   { "model": "jev-latest", "state": string | object | array,
//     "questions": { "<id>": { "type": "choice", "instructions": "...", "criteria": { "option1": "description", ... } },
//                    "<id>": { "type": "score", "instructions": "...", "criteria": ["Level 1", "Level 2", ...] } } }
//   -> { "model": "string", "answers": { "<id>": { "type": "noul|choice|score", "noul": 0.0-1.0,
//        "choice": "selected_option", "probabilities": { "option": 0.0-1.0 }, "score": 0.0-10.0,
//        "confidence": 0.0-1.0, "legend": { "0": "description" } } }, "usage": { "input_tokens": 0, "output_tokens": 0 } }
// "jev-latest" pointed to jev-1.13.0 in September 2026; versioned ids work in requests (flaviocopes.com/jev-api-key).
// The AI Gateway takes the same body and answers in the same shape (vercel.com/docs/ai-gateway/sdks-and-apis/typesafe).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runOracle } from './oracle-run.mjs';

const DANGER = ['safe', 'watch', 'danger', 'now'];
const INSTRUCT = 'You are playing Chair Massage Fundamentals. Pick the one action that best serves the goal right now. '
  + 'In the massage course the goal is to answer every client call correctly and quickly (lighter: tap S; harder: hold W; right there: keep off W and S; '
  + 'a little left / right: tap A / D), keep the modality the client wants (Space matches it), and press E for the next client. '
  + 'In the run the goal is to keep the chair and reach the exit without being knocked down or arrested.';
// The run's rules in one paragraph (DESIGN.md "The run"): what a player learns from the HUD and the first deaths.
const RUN_RULES = 'You are playing the run of Chair Massage Fundamentals. You win by reaching the exit with the chair (carried, or loaded in the car you drive) '
  + 'and 0 wanted stars. Leaving without the chair loses. Goons (Serenity Group) want the chair: they chase, shove, grab and swing bats; when one winds up on you, '
  + 'counter (tap Q) drops him for 3 s; counter_hold (hold Q through the wind-up) TREATS him (out of the chase for about two minutes) but plants you for it. Only one goon swings at a time; the rest circle. '
  + 'Palms never raise wanted on goons or pedestrians; any action on a cop raises it; a chair swing or a car hitting a goon or pedestrian raises it; taking a car raises it. '
  + 'Arrest: a cop touches you while you stand still for 1.5 s, or you are knocked down next to a cop. Wanted falls one star per 25 s no cop can see you. '
  + 'A mini-massage cools it: set the chair down (E while carrying it), a pedestrian walks over and kneels, hold E and answer their calls '
  + '(lighter: tap S; harder: hold W; right there: keep off W and S); success pays and drops one star, but any goon or cop within 6 m stops it. '
  + 'To move the chair by car: carry it to a car, E loads it, get in, drive. Goons pull you out of a car that is stopped or slow, and bat it. '
  + 'The code-steered macros (go_to_chair, go_to_car, run_to_exit, face_exit_steer, drive_to_chair) handle bearings and routes for you.';
const PLAN = { fight: 'Fight: counter and palm the goons (or swing the chair).', flee_on_foot: 'Flee on foot, carrying the chair.', get_a_car: 'Get the chair into a car and drive.',
  massage: 'Set the chair down and give a mini-massage (drops a star).', head_for_exit: 'Head for the exit now.', wait: 'Wait and see.' };

// The run's question battery (the owner: output is free, so ask many questions per state): the action
// and the danger as in the course, plus which nearby entity is the real threat, whether the chair is
// safe where it is, and the plan. Only the action drives the game; the rest is logged for review.
function runQuestions(obs) {
  const s = obs.state, threats = {};
  for (const n of (s.near || [])) if (['goon', 'boss', 'cop', 'ranger'].includes(n[1]) || (n[1].startsWith('car:') && (n[4] === 'goons' || n[4] === 'cops'))) threats[n[0]] = `${n[1].replace('car:', '')} ${n[0]}, ${Math.round(n[2])} m, ${n[4]}${n[5] ? ` (${n[5]})` : ''}`;
  threats.none = 'No real threat right now.';
  return {
    threat: { type: 'choice', instructions: 'Which nearby entity is the real threat to you or the chair right now?', criteria: threats },
    chair: { type: 'noul', instructions: 'Is the chair safe where it is right now (you have it, or nobody can take it before you get back to it)?' },
    plan: { type: 'choice', instructions: 'What should the overall plan be for the next ten seconds?', criteria: PLAN },
  };
}

export const MODEL_HELP = `--model oracle | jev | cf | laya | claude | openai:<model-id>
  cf:     Cloudflare Workers AI typesafe/jev: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID, or a wrangler login
  laya:   the local Laya sidecar (python tools/jev/laya-server.py in tools/jev/.venv); LAYA_URL to move it
  jev:    set TYPESAFE_API_KEY (console.typesafe.ai > API Keys), or AI_GATEWAY_API_KEY (Vercel AI Gateway)
  claude: set ANTHROPIC_API_KEY (optional CLAUDE_MODEL, default claude-haiku-4-5-20251001)
  openai: set PILOT_OPENAI_API_KEY (optional PILOT_OPENAI_BASE_URL, default https://inference-api.nousresearch.com/v1)`;

function need(name, alt) {
  if (process.env[name] || (alt && process.env[alt])) return;
  throw new Error(`the chosen model needs ${name}${alt ? ` (or ${alt})` : ''} in the environment; it is not set.\nKeys are read from the environment only, never from a file in the repo.\n${MODEL_HELP}`);
}

// 429 / 5xx / network errors retry with backoff (1, 2, 4 ... s, capped at 30 s, RETRIES tries): Jev's gateway answered
// "high demand" and 503 on the first real flight (2026-09-25). The sim is paused, so waiting is free.
const RETRIES = Number(process.env.PILOT_RETRIES || 12);
const backoff = (i) => 1000 * Math.min(30, 2 ** i);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(url, headers, body) {
  const t0 = Date.now();
  let last = null;
  for (let i = 0; i < RETRIES; i++) {
    let r, text;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
      text = await r.text();
    } catch (err) { last = new Error(`${url}: ${err.message}`); await sleep(backoff(i)); continue; }
    if (r.ok) return { json: JSON.parse(text), ms: Date.now() - t0, retries: i };
    last = new Error(`${url}: HTTP ${r.status} ${text.slice(0, 400)}`);
    if (r.status !== 429 && r.status !== 424 && r.status < 500) break;   // 424: the gateway reporting a typesafe upstream error; retry it too
    process.stderr.write(`  retry ${i + 1}/${RETRIES} after HTTP ${r.status}
`);
    await sleep(backoff(i));
  }
  throw last;
}

// The LLM sites: a JSON-only reply, parsed leniently (a code fence or prose around it is tolerated).
function prompt(obs) {
  return `${obs.text}\n\nValid actions (id: what it does):\n${Object.entries(obs.options).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n`
    + 'Reply with JSON only, no prose: {"action": "<one id from the list>", "danger": <0 safe, 1 watch, 2 danger, 3 now>}';
}
function parseReply(text, obs) {
  const m = String(text).match(/\{[\s\S]*\}/);
  let o = {};
  try { o = JSON.parse(m ? m[0] : text); } catch { o = {}; }
  const action = typeof o.action === 'string' ? o.action.trim() : '';
  return { action, danger: Number.isFinite(o.danger) ? DANGER[Math.max(0, Math.min(3, o.danger))] : null, raw: action in obs.options ? undefined : String(text).slice(0, 200) };
}

function oracle() {
  const ANSWER = { lighter: 'answer_lighter', harder: 'answer_harder', still: 'stay_still', left: 'answer_left', right: 'answer_right' };
  const MINI = { lighter: 'mini_answer_lighter', harder: 'mini_answer_harder', still: 'mini_answer_still' };
  return {
    name: 'oracle',
    async decide(obs) {
      const o = obs.options, s = obs.state, pick = (...ids) => ids.find((id) => id in o) || 'wait';
      if (s.call && s.call.open) return { action: pick(ANSWER[s.call.name]), ms: 0 };
      if (s.mini && s.mini.call && s.mini.call.open) return { action: pick(MINI[s.mini.call.name]), ms: 0 };
      if (s.st === 'RUN') return { action: runOracle(obs), ms: 0 };
      return { action: pick('click_begin', 'skip_intro', 'next_client', 'track_ring_on', 'match_modality'), ms: 0 };
    },
  };
}

// The TypeSafe question set, shared by every systemone-shaped site (jev, cf, laya): the action and
// the danger, plus the run's battery in the RUN.
function battery(obs) {
  const inRun = obs.state.st === 'RUN';
  return {
    action: { type: 'choice', instructions: inRun ? `${RUN_RULES} Pick the one action that best serves the goal right now.` : INSTRUCT, criteria: obs.options },
    danger: { type: 'score', instructions: 'How close is the player to being knocked down, arrested or losing the chair?', criteria: DANGER },
    ...(inRun ? runQuestions(obs) : {}),
  };
}
function readAnswers(A = {}, obs) {
  const a = A.action, d = A.danger;
  const q = obs.state.st === 'RUN' ? { threat: A.threat && { c: A.threat.choice, p: A.threat.probabilities }, chair: A.chair ? A.chair.noul : null, plan: A.plan && { c: A.plan.choice, p: A.plan.probabilities } } : undefined;
  return { action: a && a.choice, probs: a && a.probabilities, conf: a && a.confidence, danger: d ? d.score : null, q };
}

function jev() {
  need('TYPESAFE_API_KEY', 'AI_GATEWAY_API_KEY');
  const direct = !!process.env.TYPESAFE_API_KEY;
  const url = process.env.JEV_BASE_URL ? `${process.env.JEV_BASE_URL.replace(/\/$/, '')}/v1/systemone`   // a proxy or a test double
    : direct ? 'https://api.typesafe.ai/v1/systemone' : 'https://ai-gateway.vercel.sh/typesafe/v1/systemone';
  const key = direct ? process.env.TYPESAFE_API_KEY : process.env.AI_GATEWAY_API_KEY;
  const model = process.env.JEV_MODEL || (direct ? 'jev-1.13.0' : 'typesafe-ai/jev');
  // Through the gateway, which provider pool to try first (it routed Jev to a DigitalOcean pool that
  // answered 429 under demand, 2026-09-25): PILOT_JEV_ORDER, comma-separated.
  const order = (process.env.PILOT_JEV_ORDER || 'typesafe-ai,digitalocean').split(',').map((x) => x.trim()).filter(Boolean);
  const route = direct ? {} : { providerOptions: { gateway: { order } } };
  return {
    name: `jev (${model}${direct ? '' : ' via AI Gateway'})`,
    async decide(obs) {
      const { json, ms, retries } = await post(url, { authorization: `Bearer ${key}` }, { model, state: obs.text, ...route, questions: battery(obs) });
      const R = json.provider_metadata && json.provider_metadata.gateway && json.provider_metadata.gateway.routing;
      return { ...readAnswers(json.answers, obs), ms, retries, prov: R ? R.resolvedProvider || R.finalProvider || null : null };
    },
  };
}

// Cloudflare Workers AI hosts typesafe/jev: POST .../accounts/<id>/ai/run, body {model, input: {state,
// questions}} (the TypeSafe shape inside `input`), answer {result: {answers, usage}}. Token and account
// from CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID, else wrangler's OAuth login (default.toml, which
// has ai:write) and the token's first account. Neither is ever printed. 402 means the owner's
// Cloudflare AI Gateway balance is empty: stop with that, do not retry.
function cfToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const f = join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml');
  let m = null;
  try { m = readFileSync(f, 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m); } catch { m = null; }
  if (!m) throw new Error(`cf needs CLOUDFLARE_API_TOKEN (Workers AI permission) or a wrangler login (${f}); neither found.
${MODEL_HELP}`);
  return m[1];
}
function cf() {
  const token = cfToken();
  const model = process.env.CF_JEV_MODEL || 'typesafe/jev';
  let account = process.env.CLOUDFLARE_ACCOUNT_ID || null;
  return {
    name: `cf (${model} on Workers AI)`,
    async decide(obs) {
      if (!account) {
        const r = await fetch('https://api.cloudflare.com/client/v4/accounts', { headers: { authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => ({}));
        account = j.result && j.result[0] && j.result[0].id;
        if (!account) throw new Error(`cf: no account visible to the token (HTTP ${r.status}); set CLOUDFLARE_ACCOUNT_ID`);
      }
      let res;
      try {
        res = await post(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run`, { authorization: `Bearer ${token}` }, { model, input: { state: obs.text, questions: battery(obs) } });
      } catch (err) {
        if (/HTTP 402/.test(err.message)) throw new Error('cf: HTTP 402, insufficient balance: the Cloudflare AI Gateway needs credits (or BYOK) before typesafe/jev answers. Top up, then re-run.');
        throw new Error(err.message.replace(/accounts\/[0-9a-f]+/, 'accounts/<id>'));
      }
      const R = res.json.result || {};
      return { ...readAnswers(R.answers, obs), ms: res.ms, retries: res.retries, prov: 'cloudflare' };
    },
  };
}

// Laya (Apache 2.0, convaiinnovations/laya, 421M ModernBERT-large): a local open clone with the same
// state + questions API, served by tools/jev/laya-server.py on LAYA_URL (default 127.0.0.1:8899).
function laya() {
  const url = (process.env.LAYA_URL || 'http://127.0.0.1:8899').replace(/\/$/, '');
  return {
    name: `laya (local sidecar ${url})`,
    async decide(obs) {
      const { json, ms, retries } = await post(`${url}/v1/systemone`, {}, { model: 'laya', state: obs.text, questions: battery(obs) });
      const F = json.fit || {}, qs = Object.keys(F).filter((k) => F[k] && typeof F[k] === 'object');
      const fit = { ck: F.checkpoint, tok: F.state_tokens, cut: qs.filter((k) => F[k].state_cut), head: qs.filter((k) => F[k].head_cut), opt: qs.filter((k) => F[k].opt_cut) };
      return { ...readAnswers(json.answers, obs), ms, lms: json.ms, retries, prov: 'laya-local', fit };
    },
  };
}

function claude() {
  need('ANTHROPIC_API_KEY');
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  return {
    name: `claude (${model})`,
    async decide(obs) {
      const { json, ms } = await post(`${(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`,
        { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        { model, max_tokens: 60, temperature: 0, system: INSTRUCT, messages: [{ role: 'user', content: prompt(obs) }] });
      const text = (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { ...parseReply(text, obs), ms };
    },
  };
}

function openai(model) {
  if (!model) throw new Error(`openai needs a model id: --model openai:<model-id>\n${MODEL_HELP}`);
  need('PILOT_OPENAI_API_KEY');
  const base = (process.env.PILOT_OPENAI_BASE_URL || 'https://inference-api.nousresearch.com/v1').replace(/\/$/, '');
  return {
    name: `openai (${model} at ${base})`,
    async decide(obs) {
      const { json, ms } = await post(`${base}/chat/completions`, { authorization: `Bearer ${process.env.PILOT_OPENAI_API_KEY}` },
        { model, max_tokens: 60, temperature: 0, messages: [{ role: 'system', content: INSTRUCT }, { role: 'user', content: prompt(obs) }] });
      const text = json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : '';
      return { ...parseReply(text, obs), ms };
    },
  };
}

export function makeModel(spec) {
  const [kind, ...rest] = String(spec || 'oracle').split(':');
  if (kind === 'oracle') return oracle();
  if (kind === 'jev') return jev();
  if (kind === 'claude') return claude();
  if (kind === 'cf') return cf();
  if (kind === 'laya') return laya();
  if (kind === 'openai') return openai(rest.join(':'));
  throw new Error(`unknown model "${spec}"\n${MODEL_HELP}`);
}
