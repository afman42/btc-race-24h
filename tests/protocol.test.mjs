import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

const hello = {
  type: 'hello', protocol: 'agent-fun/bars-replay/v1', seed: '7',
  symbols: [{ symbol: 'CBBTC', mint: 'test-mint', price_scale: 5, qty_scale: 8 }],
  capital: { quote: 'USDC', quote_scale: 6, quote_units: '1000000000' },
  bar_interval: '1m', first_close_ms: 60_000, latency_bars: 1,
  caps: { max_open_positions: 1, max_orders_per_bar: 16, max_weight_bps: 10000, shorts: false, leverage: false },
  fees: { fee_bps: 4, slippage_bps: 2, min_notional_quote_units: '1000000' },
};
const account = { cash_quote_units: '1000000000', positions: [], equity_quote_units: '1000000000' };
const bar = (seq) => ({
  type: 'batch', seq, t: (seq + 1) * 60_000,
  bars: [{ symbol: 'CBBTC', t: (seq + 1) * 60_000, o: '6000000000', h: '6000000000', l: '6000000000', c: '6000000000', v: null, o_depth: ['600000000000'], c_depth: ['600000000000'] }],
  fills: [], account,
});

function execute(lines) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['main.ts'], { cwd: new URL('..', import.meta.url), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(`${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
  });
}

test('actual entrypoint replies once per batch, echoes seq, and stays silent for hello and done', async () => {
  const messages = [hello, bar(0), bar(1), { type: 'done', seq: 2, reason: 'end_of_data', account }];
  const result = await execute(messages);
  assert.equal(result.code, 0, result.stderr);
  const replies = result.stdout.trim().split('\n').map(JSON.parse);
  assert.deepEqual(replies, [
    { type: 'reply', seq: 0, orders: [] },
    { type: 'reply', seq: 1, orders: [] },
  ]);
});

test('two actual entrypoint runs are byte-identical', async () => {
  const messages = [hello, ...Array.from({ length: 200 }, (_, seq) => bar(seq)), { type: 'done', seq: 200, reason: 'end_of_data', account }];
  const first = await execute(messages);
  const second = await execute(messages);
  assert.equal(first.code, 0, first.stderr);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
});
