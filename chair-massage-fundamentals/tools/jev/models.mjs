// The pilot's decision makers, one interface: makeModel(spec) -> { name, decide(obs) } where obs is
// CMF.agent.observe() ({ text, options: {id: line}, state, tick }) and decide resolves to
// { action, probs?, danger?, ms }. Keys come from the environment only and never touch the repo;
// a model whose key is missing refuses to start with a message that says what to set.
//   oracle          no model: reads the open call from the observation and answers it right (the
//                   harness proof while no key is at hand).
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

const DANGER = ['safe', 'watch', 'danger', 'now'];
const INSTRUCT = 'You are playing Chair Massage Fundamentals. Pick the one action that best serves the goal right now. '
  + 'In the massage course the goal is to answer every client call correctly and quickly (lighter: tap S; harder: hold W; right there: keep off W and S; '
  + 'a little left / right: tap A / D), keep the modality the client wants (Space matches it), and press E for the next client. '
  + 'In the run the goal is to keep the chair and reach the exit without being knocked down or arrested.';

export const MODEL_HELP = `--model oracle | jev | claude | openai:<model-id>
  jev:    set TYPESAFE_API_KEY (console.typesafe.ai > API Keys), or AI_GATEWAY_API_KEY (Vercel AI Gateway)
  claude: set ANTHROPIC_API_KEY (optional CLAUDE_MODEL, default claude-haiku-4-5-20251001)
  openai: set PILOT_OPENAI_API_KEY (optional PILOT_OPENAI_BASE_URL, default https://inference-api.nousresearch.com/v1)`;

function need(name, alt) {
  if (process.env[name] || (alt && process.env[alt])) return;
  throw new Error(`the chosen model needs ${name}${alt ? ` (or ${alt})` : ''} in the environment; it is not set.\nKeys are read from the environment only, never from a file in the repo.\n${MODEL_HELP}`);
}

async function post(url, headers, body) {
  const t0 = Date.now();
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status} ${text.slice(0, 400)}`);
  return { json: JSON.parse(text), ms: Date.now() - t0 };
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
      return { action: pick('click_begin', 'skip_intro', 'next_client', 'track_ring_on', 'match_modality'), ms: 0 };
    },
  };
}

function jev() {
  need('TYPESAFE_API_KEY', 'AI_GATEWAY_API_KEY');
  const direct = !!process.env.TYPESAFE_API_KEY;
  const url = direct ? 'https://api.typesafe.ai/v1/systemone' : 'https://ai-gateway.vercel.sh/typesafe/v1/systemone';
  const key = direct ? process.env.TYPESAFE_API_KEY : process.env.AI_GATEWAY_API_KEY;
  const model = process.env.JEV_MODEL || (direct ? 'jev-1.13.0' : 'typesafe-ai/jev');
  return {
    name: `jev (${model}${direct ? '' : ' via AI Gateway'})`,
    async decide(obs) {
      const { json, ms } = await post(url, { authorization: `Bearer ${key}` }, {
        model, state: obs.text,
        questions: {
          action: { type: 'choice', instructions: INSTRUCT, criteria: obs.options },
          danger: { type: 'score', instructions: 'How close is the player to being knocked down, arrested or losing the chair?', criteria: DANGER },
        },
      });
      const a = json.answers && json.answers.action, d = json.answers && json.answers.danger;
      return { action: a && a.choice, probs: a && a.probabilities, conf: a && a.confidence, danger: d ? d.score : null, ms };
    },
  };
}

function claude() {
  need('ANTHROPIC_API_KEY');
  const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
  return {
    name: `claude (${model})`,
    async decide(obs) {
      const { json, ms } = await post('https://api.anthropic.com/v1/messages',
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
  if (kind === 'openai') return openai(rest.join(':'));
  throw new Error(`unknown model "${spec}"\n${MODEL_HELP}`);
}
