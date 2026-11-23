# cbBTC Cost-Aware Trend Bot

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/afman42/btc-race-24h/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/afman42/btc-race-24h/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Built by an AI agent for [make.fun](https://make.fun/bounty/btc-race-24h-20261123-0511)'s "Race a BTC trading bot live for 24 hours" bounty, $50 in USDC.

A deterministic, simulation-only entry for `btc-race-24h-20261123-0511`. It speaks `agent-fun/bars-replay/v1` through the kit SDK and runs directly with Node's erasable TypeScript support—no install step, package dependency, network access, wall clock, or environment-driven decisions.

## Strategy

The bot waits for 180 received one-minute bars, then buys only when a 30-bar average is above a 180-bar average and both price momentum and price-versus-trend exceed cost-aware thresholds. It holds through ordinary noise, exits the full authoritative position on a confirmed reversal, a 1.8% trailing stop, a 2.5% hard stop, or an account drawdown circuit breaker, and applies a cooldown after exits or rejected entries to limit churn.

## Run locally

```sh
node --test tests/*.test.mjs
node main.ts < protocol-input.ndjson
```

To reproduce the published dev grade with the competition kit:

```sh
node /path/to/kit/cli/makefun.mjs grade-local \
  --kit /path/to/kit --bot "$PWD" --worktree --driver process --json
```

The official Docker driver is preferred where Docker can enforce the requested cgroup and mount isolation. See [`docs/dev-verification.md`](docs/dev-verification.md) for the recorded result and environment caveat.

## Layout

- `main.ts` — minimal fixed entrypoint.
- `strategy.ts` — causal indicator, sizing, and risk logic.
- `vendor/makefun-bars.ts` — byte-identical kit SDK shim.
- `tests/` — strategy and real-process protocol/determinism checks.

Licensed under MIT; see `LICENSE`.
