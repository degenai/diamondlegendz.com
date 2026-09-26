"""Laya as a local systemone endpoint for the Jev pilot (tools/jev/models.mjs --model laya).

Laya (Apache 2.0, pip `laya`, HF convaiinnovations/laya) is an open, non-autoregressive System One
clone: the same state + typed questions (choice / score / noul) as TypeSafe's Jev, one forward pass.
This wraps laya.Router.predict in a tiny HTTP server so the pilot treats it like any other site:

    POST /v1/systemone  {"state": str|dict, "questions": {...}}  ->  {"model", "answers", "routing", "ms"}
    GET  /health        ->  {"ok": true, "device": ..., "loaded": [...]}

Run it from the venv (tools/jev/.venv, git-ignored; CPU torch):
    tools/jev/.venv/Scripts/python tools/jev/laya-server.py [--port 8899] [--model english] [--device cpu]
Loopback only. One request at a time (the pilot is sequential), so no locking.
"""
import argparse
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from laya import Router
from laya.common import render_options, serialize_state

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=8899)
ap.add_argument("--model", default=None, help="force a checkpoint (english | multilingual | typed-decisions); default: the router picks")
ap.add_argument("--device", default="cpu")
args = ap.parse_args()

t0 = time.time()
router = Router(device=args.device, preload=False)
router.load(args.model or "english")
print(f"laya-server: loaded in {time.time() - t0:.1f} s on {args.device}", flush=True)


# What Laya actually read, per question (laya/common.py build_sequence): the state's tokens against the
# room left after the question head, whether the state was cut (it keeps the start), whether the
# instructions were cut to fit the options (a 192-token head budget), and whether options were cut.
def fit(state, questions, name):
    agent = router.load(name)
    tok, cfg = agent.tok, agent.cfg
    max_len, head_max = cfg.get("max_len", 512), cfg.get("head_max_len", 192)
    st = len(tok(serialize_state(state), add_special_tokens=False)["input_ids"])
    out = {"checkpoint": name, "max_len": max_len, "state_tokens": st}
    for qid, q in questions.items():
        qi = agent._to_internal(q)
        opts = [len(tok(" " + o, add_special_tokens=False)["input_ids"]) for o in render_options(qi)]
        opt_cut = any(n > 48 for n in opts)
        o_ids = sum(min(48, n) + 1 for n in opts)
        if head_max - o_ids < 16:
            per = max(4, (head_max - 16) // max(1, len(opts)))
            opt_cut = opt_cut or any(min(48, n) + 1 > per for n in opts)
            o_ids = sum(min(per, min(48, n) + 1) for n in opts)
        head = len(tok("%s question: %s" % (qi["t"], qi["ins"]), add_special_tokens=False)["input_ids"])
        head_keep = min(head, max(8, head_max - o_ids))
        room = max(0, max_len - (head_keep + o_ids + 2) - 1)
        out[qid] = {"room": room, "state_cut": st > room, "head_cut": head_keep < head, "opt_cut": opt_cut}
    return out


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "device": args.device, "loaded": list(router.loaded)})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/v1/systemone":
            return self._send(404, {"error": "not found"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
            t = time.time()
            res = router.predict(req["state"], req["questions"], model=args.model)
            res["ms"] = round((time.time() - t) * 1000, 1)
            res["fit"] = fit(req["state"], req["questions"], res.get("routing", {}).get("model") or args.model or "english")
            res["model"] = "laya"
            self._send(200, res)
        except Exception as err:  # the pilot sees a 500 and stops with the message
            self._send(500, {"error": f"{type(err).__name__}: {err}"})

    def log_message(self, *a):
        pass


HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
