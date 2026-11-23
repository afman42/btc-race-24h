# Cost-aware BTC replay bot design

## Intent and constraints
Build an original deterministic paper-trading entry for `btc-race-24h-20261123-0511`. The published 1,440-bar dev window must finish strictly profitable after the official fill model; the live race is unknown and dev profit is not a prediction. Use Node 22 erasable TypeScript, standard library and an unchanged kit SDK under `vendor/`, one reply per batch, next-open fills, long only and one position. Preserve the makefun anchor and MIT commits. No push, transcript bundle, intake check or submission in this worker.

## Approaches
- Buy-and-hold: cheap but ignores falling markets and duplicates a house strategy.
- Fast crossover/mean reversion: adapts rapidly but risks paying roughly 26–50 bps for each short-lived signal.
- **Chosen builder approach:** slow, cost-aware momentum with hysteresis, a small initial participation position, risk-limited trend exposure and wide protective exits. The user delegated implementation choices; this is a builder decision, not a claim of separate design approval.

## Architecture
`main.ts` wires the unchanged SDK to `strategy.ts`. The strategy uses only received close/high/low prices and accounts: integer EMAs, a bounded momentum history, smoothed true range, filled-position cost, and an equity high-water mark. All quantities and monetary calculations use BigInt. It never loads the dev dataset or keys off absolute timestamps, seed, wall clock, environment or future bars.

A small first position ensures participation if the market is quiet. Scaling toward a capped target requires upward EMA alignment and trailing momentum comfortably above estimated fees, slippage and impact. No per-bar rebalancing. Exits use a hard loss stop, a volatility-aware trailing stop and a confirmed slow reversal; a cooldown avoids immediately buying back. Account drawdown triggers a permanent cash-only circuit breaker. Protective exits are next-open orders, not intrabar fills, so gaps and slippage can exceed their thresholds; no stop can guarantee the race drawdown.

## Proof
Synthetic tests exercise quiet/rising/falling prices, warm-up, missing bars, fill rejection, caps, dust and loss controls. Process smoke tests exercise the actual NDJSON entrypoint. The official kit grader verifies the dataset from its 42,947 samples, runs the bot twice and rescores the action log. Two independently saved full-window grades must have byte-identical action logs, net PnL > 0, at least one trade and drawdown <= 25%. Keep grader outputs outside the repository; commit a concise evidence report, not market data or logs.
