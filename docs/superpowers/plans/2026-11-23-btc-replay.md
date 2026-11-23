# BTC Replay Bot Implementation Plan

> **For agentic workers:** Native implementation in this session, as requested by the coordinator. Follow test-driven-development and verification-before-completion for each task.

**Goal:** Commit a deterministic, original cbBTC/USDC paper bot with positive official dev PnL and reproducible action logs.

**Architecture:** Unchanged vendored SDK owns the hello/batch/done wire and integer account. One strategy module owns causal indicators and risk decisions; the root entrypoint only connects them. Local tests and grader evidence do not enter trading decisions.

**Tech Stack:** Node 22 erasable TypeScript; `node:test`, `node:assert`, `node:child_process`; unchanged kit SDK.

**Spec:** `docs/superpowers/specs/2026-11-23-btc-replay-design.md`

## Global Constraints
- Runtime command: `node /bot/main.ts`; imports include `.ts`.
- Start: 1,000 USDC; long only, no leverage, at most one position.
- Exactly one JSON reply per batch echoing seq; no hello/done reply; max 16 orders.
- Next-bar open fills; monetary quantities and cash use BigInt.
- No network, wall clock, outside files, install step or environment-based variation in the bot.
- Preserve initialization history; commit work; no push, bundle, intake check or submit.

## Review Focus
- Missing bars must not create synthetic momentum observations or stale-price buys.
- Rejected orders must not become imagined positions or latch an unfilled entry.
- Warm-up may update indicators but must never send orders.
- Minimum notional, weight room and one-position caps apply before an order is sent.
- Stops use received accounts and next-open execution; dust exits sell exactly what is held.

## Task 1: Tested causal strategy
**Files:** create `strategy.ts`, `tests/strategy.test.mjs`, `vendor/makefun-bars.ts` (exact kit copy).
**Interfaces:** export `createStrategy(): Bot`; consumes SDK `BarsState` and `Batch`.
- [ ] Write tests for first participation buy, monotone uptrend scaling, quiet-market no-churn, warm-up, missing bars, caps, rejected entries, full-quantity exit and drawdown circuit breaker.
- [ ] Run `node --test tests/strategy.test.mjs`; observe missing strategy/behavior failures.
- [ ] Implement integer indicators, cost gate, target sizing, confirmed exits and cooldown.
- [ ] Run full suite; investigate failures before changing implementation.

## Task 2: Actual entrypoint and local grade
**Files:** create `main.ts`, `tests/protocol.test.mjs`; revise runtime code if the tests expose bugs.
**Interfaces:** entry runs `await runBars(createStrategy())`.
- [ ] Write executable NDJSON tests: exactly one reply per batch, correct seq, unique IDs, no output on hello/done, malformed input fails, two runs identical.
- [ ] Observe failures, then implement entrypoint and run the full suite.
- [ ] Grade current files with the published kit (`--worktree`), Docker preferred; process is a diagnostic fallback.
- [ ] Inspect official net PnL, trades, drawdown and execution status. If profit <= 0, revise general thresholds and repeat without timestamp/bar-specific fitting.

## Task 3: Final evidence and preserved-history commit
**Files:** create `README.md`, `docs/dev-verification.md`.
- [ ] Re-run full tests on the chosen runtime and two independently saved official grades.
- [ ] Compare saved action-log files with `cmp` and SHA-256; assert positive PnL, trades >= 1, drawdown <= 0.25, deterministic and successful L1 replay.
- [ ] Document exact values, commands, Docker/runtime caveats and strategy limitations. Keep raw grade artifacts outside this repo.
- [ ] Verify SDK copy hash, allowed imports and root entrypoint; commit all tracked work without rewriting either initial commit.
- [ ] Grade committed HEAD again and report language, 2–3 sentence strategy, PnL/trades/drawdown and SHA.
