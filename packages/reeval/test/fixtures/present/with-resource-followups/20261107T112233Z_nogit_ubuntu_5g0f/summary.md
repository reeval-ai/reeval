# Run 20261107T112233Z_nogit_ubuntu_5g0f

1 of 2 counted attempts passed. 8s wall time. Tokens: not reported. Cost: not reported.

Run `20261107T112233Z_nogit_ubuntu_5g0f` by ubuntu, 2026-11-07, reeval 0.21.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - canary: 1 counted attempt reported no token usage; token medians omit them. [A1](#attempt-evals-canary-eval-ts-canary-fake-busy-docker-1-115b72c5)
> - lands: 1 counted attempt reported no token usage; token medians omit them. [A2](#attempt-evals-lands-eval-ts-lands-fake-busy-docker-1-2ad5830f)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 2 attempts |

## canary

`evals/canary.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](#attempt-evals-canary-eval-ts-canary-fake-busy-docker-1-115b72c5) | Fake | fail | not reported | 0ms | not reported | expected 0 to be greater than or equal to 2 |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBeGreaterThanOrEqual 2 | toBeGreaterThanOrEqual | evals/canary.eval.ts:6 | 0 of 1 | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toBeGreaterThanOrEqual 2 | expected 0 to be greater than or equal to 2 | evals/canary.eval.ts:6 | 1 of 1 | [A1](#attempt-evals-canary-eval-ts-canary-fake-busy-docker-1-115b72c5) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## lands

`evals/lands.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A2](#attempt-evals-lands-eval-ts-lands-fake-busy-docker-1-2ad5830f) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBeGreaterThanOrEqual 2 | toBeGreaterThanOrEqual | evals/lands.eval.ts:7 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## Tally

Evals: 1 fail · 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.9 · id ea04ec11a87c · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | fake |
| Resources | docker 1 vCPU 512 MiB: 2 attempts · CPU 3.3 s (avg 0.84, peak 1.00 cores) · memory peak 306 MiB |
| Environments | busy eca09e8f139f |
| Judge | none by default · threshold 0.8 · version a3ce9d328e88 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.16 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.16 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.9 · @ai-sdk/harness-claude-code 1.0.176-patch.a9d56a8c · @reeval/harness-codex 0.1.13 · @reeval/harness-fx 0.1.11 · @reeval/harness-grok-build 0.1.12 · ai 7.0.161 · @ai-sdk/harness 1.0.172 · @ai-sdk/anthropic 4.0.95 · @ai-sdk/google 4.0.110 · @ai-sdk/openai 4.0.107 · @ai-sdk/typesafe-ai 3.0.32 |
| reeval | 0.21.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · ubuntu |
| Artifacts | all |

> **Warning:** Image reeval-sandbox:cursor-0.1.9 isn't pushed, so an exact rerun needs this machine's image (id ea04ec11a87c).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-canary-eval-ts-canary-fake-busy-docker-1-115b72c5"></a>A1 | canary | Fake | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-lands-eval-ts-lands-fake-busy-docker-1-2ad5830f"></a>A2 | lands | Fake | pass | not reported | 0ms | 0 | not recorded | n/a |
