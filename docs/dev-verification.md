# Published dev-window verification

Verified on 23 November 2026 against kit `btc-race-24h-20261123-0511`, its published 1,440 one-minute cbBTC bars, and the kit's `grade-local` command.

## Result

| Metric | Value |
| --- | ---: |
| Status | `finished` |
| Net PnL | `7,517,053` micro-USDC = **+7.517053 USDC** |
| Return | `0.007517053` = **+0.7517053%** |
| Bot trades | **4** |
| Maximum drawdown | `0.027541259` = **2.7541259%** |
| Fees | `1,617,078` micro-USDC |
| Net PnL at 2x fees | `5,909,332` micro-USDC = **+5.909332 USDC** |
| Rejected orders | **0** |
| Guardrails | trades, symbols, drawdown: **compliant** |
| L1 action-log replay | **reproduced** |

Two independent full `grade-local --driver process --worktree --json` invocations produced byte-identical `action-log.json` files and byte-identical `result.json` files:

- Action log SHA-256: `54bdf156d01f85d4e23f35aea1c76e583208695e44167ba168a07aabccc56e70`
- Result SHA-256: `c20203ba48b918d6b9f25114bb9fc8ff56c87b03270df0fd3a66d24abd0c4daa`

The process driver reported the expected local mismatch: the kit harness used local Node `v24.22.1`, while its server metadata names a newer harness Node. The bot itself uses only Node 22 erasable TypeScript features.

## Docker caveat

The pinned Docker image was pulled and its digest verified, but this nested VM cannot run the exact Docker grade because its kernel exposes neither the CPU CFS controller requested by `NanoCPUs` nor the mount-namespace operation required by `runc`. The first exact-driver attempt therefore ended before the bot ran with:

```
NanoCPUs can not be set, as your kernel does not support CPU CFS scheduler or the cgroup is not mounted
```

A separate container smoke attempt also ended before the command with `setns: operation not permitted`. For that reason the recorded official-kit proof uses the documented process fallback, plus real-process protocol tests and two full replay/action-log comparisons. Raw grade artifacts stay outside this repository.

## Commands

```sh
node --test tests/*.test.mjs

node /path/to/kit/cli/makefun.mjs grade-local \
  --kit /path/to/kit \
  --bot /home/hatch/workspace/btc-race-24h-pi \
  --worktree --driver process --save /outside/repo/grade-process-1 --json

# Repeat with grade-process-2, then:
cmp /outside/repo/grade-process-1/action-log.json /outside/repo/grade-process-2/action-log.json
cmp /outside/repo/grade-process-1/result.json /outside/repo/grade-process-2/result.json
```
