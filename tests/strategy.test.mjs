import assert from 'node:assert/strict';
import test from 'node:test';
import { BarsState } from '../vendor/makefun-bars.ts';
import { createStrategy } from '../strategy.ts';

function hello(overrides = {}) {
  return {
    type: 'hello',
    protocol: 'agent-fun/bars-replay/v1',
    seed: '7',
    symbols: [{ symbol: 'CBBTC', mint: 'test-mint', price_scale: 5, qty_scale: 8 }],
    capital: { quote: 'USDC', quote_scale: 6, quote_units: '1000000000' },
    bar_interval: '1m',
    first_close_ms: 60_000,
    latency_bars: 1,
    caps: { max_open_positions: 1, max_orders_per_bar: 16, max_weight_bps: 10000, shorts: false, leverage: false },
    fees: { fee_bps: 4, slippage_bps: 2, min_notional_quote_units: '1000000' },
    ...overrides,
  };
}

function account(cash = 1_000_000_000n, qty = 0n, cost = 0n, price = 6_000_000_000n) {
  const positionValue = qty * price / 10_000_000n;
  return {
    cash_quote_units: cash.toString(),
    positions: qty === 0n ? [] : [{ symbol: 'CBBTC', qty: qty.toString(), cost_quote_units: cost.toString() }],
    equity_quote_units: (cash + positionValue).toString(),
  };
}

function batch(seq, close, acct = account(), bars = true, fills = []) {
  const c = BigInt(close);
  return {
    type: 'batch', seq, t: (seq + 1) * 60_000,
    bars: bars ? [{ symbol: 'CBBTC', t: (seq + 1) * 60_000, o: c.toString(), h: c.toString(), l: c.toString(), c: c.toString(), v: null, o_depth: ['600000000000'], c_depth: ['600000000000'] }] : [],
    fills, account: acct,
  };
}

function risingPrice(seq) {
  return 5_900_000_000n + BigInt(seq) * 2_000_000n;
}

function drive(bot, spec, rows) {
  const state = new BarsState(spec);
  bot.onHello?.(state);
  return rows.map((row) => {
    state.applyBatch(row);
    return bot.onBatch(state, row) ?? [];
  });
}

test('waits for causal history, then sends one full-size trend entry', () => {
  const spec = hello();
  const rows = Array.from({ length: 200 }, (_, seq) => batch(seq, risingPrice(seq)));
  const outputs = drive(createStrategy(), spec, rows);
  const sent = outputs.flat();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], { side: 'buy', symbol: 'CBBTC', notional_quote_units: 1_000_000_000n, max_slippage_bps: 150 });
  assert.ok(outputs.slice(0, 179).every((orders) => orders.length === 0), '180 actual closes are required before entry');
});

test('warm-up updates history but never sends an order', () => {
  const spec = hello({ warmup_bars: 190 });
  const rows = Array.from({ length: 191 }, (_, seq) => batch(seq, risingPrice(seq)));
  const outputs = drive(createStrategy(), spec, rows);
  assert.ok(outputs.slice(0, 190).every((orders) => orders.length === 0));
  assert.equal(outputs[190].length, 1);
});

test('a missing bar creates no synthetic observation or stale-price buy', () => {
  const spec = hello();
  const rows = Array.from({ length: 180 }, (_, seq) => batch(seq, risingPrice(seq)));
  rows.push(batch(180, risingPrice(180), account(), false));
  const outputs = drive(createStrategy(), spec, rows);
  assert.equal(outputs[180].length, 0);
});

test('uses the authoritative held quantity for a protective exit', () => {
  const spec = hello();
  const qty = 16_000_000n;
  const cost = 980_000_000n;
  const rows = Array.from({ length: 190 }, (_, seq) => batch(seq, risingPrice(seq), account(20_000_000n, qty, cost, risingPrice(seq))));
  rows.push(batch(190, 5_600_000_000n, account(20_000_000n, qty, cost, 5_600_000_000n)));
  const outputs = drive(createStrategy(), spec, rows);
  assert.deepEqual(outputs.at(-1), [{ side: 'sell', symbol: 'CBBTC', qty, max_slippage_bps: 150 }]);
});

test('respects the hello weight cap when sizing an entry', () => {
  const spec = hello({ caps: { max_open_positions: 1, max_orders_per_bar: 16, max_weight_bps: 2500, shorts: false, leverage: false } });
  const rows = Array.from({ length: 200 }, (_, seq) => batch(seq, risingPrice(seq)));
  const sent = drive(createStrategy(), spec, rows).flat();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].notional_quote_units, 250_000_000n);
});
