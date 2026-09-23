// State machine: enum of states, transition function, enter/exit listeners.

export const STATES = Object.freeze({
  TITLE: 'TITLE',
  MASSAGE: 'MASSAGE',
  PIVOT: 'PIVOT',
  RUN: 'RUN',
  ARREST: 'ARREST',
  DEATH: 'DEATH',
  ESCAPE: 'ESCAPE',
  SUMMARY: 'SUMMARY',
});

let current = null;
const enterFns = new Map();
const exitFns = new Map();

function listFor(map, state) {
  if (!STATES[state]) throw new Error(`Unknown state: ${state}`);
  if (!map.has(state)) map.set(state, []);
  return map.get(state);
}

export function onEnter(state, fn) { listFor(enterFns, state).push(fn); }
export function onExit(state, fn) { listFor(exitFns, state).push(fn); }

export function getState() { return current; }

let transitioning = false;
const queue = [];

// Re-entrant calls (a setState from inside an onEnter/onExit handler) are
// queued and drained after the in-flight transition finishes, so exit and
// enter listeners always run in order and against a settled `current`.
export function setState(next) {
  if (!STATES[next]) throw new Error(`Unknown state: ${next}`);
  if (transitioning) { queue.push(next); return; }
  transitioning = true;
  try {
    let target = next;
    for (;;) {
      if (target !== current) {
        const prev = current;
        if (prev) for (const fn of listFor(exitFns, prev)) fn(target);
        current = target;
        for (const fn of listFor(enterFns, target)) fn(prev);
      }
      if (!queue.length) break;
      target = queue.shift();
    }
  } finally {
    transitioning = false;
    queue.length = 0;
  }
}
