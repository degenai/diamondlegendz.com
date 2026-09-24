// MASSAGE, the money: each client's pay splits half to the therapist, half to the host cause, and
// the session totals become the run's starting cash (ctx.massageTotals). Also the HUD's ledger strip.
const usd = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Pay client c: totals, the paid list, the run's starting cash. Returns the half each side got.
export function payClient(ctx, S, c) {
  const half = c.pay / 2;
  S.totals.you += half; S.totals.host += half;
  S.paid.push({ id: c.id, pay: c.pay });
  ctx.massageTotals = { ...S.totals }; // becomes the run's starting cash later
  return half;
}

export function showPaid(ctx, S, c, half) {
  ctx.hud.setLedger([
    `${c.name} paid ${usd(c.pay)}`,
    `You ${usd(half)} / Host cause ${usd(half)}`,
    `Session total: You ${usd(S.totals.you)} / Host cause ${usd(S.totals.host)}`,
  ]);
}

// A fresh course: nothing paid yet.
export function resetLedger(ctx, S) {
  S.totals = { you: 0, host: 0 }; S.paid = [];
  ctx.hud.setLedger(['No payments yet.', 'Each client pays; half goes to the host cause.']);
}
