# Run 20261108T133503Z_nogit_cursor-agent_rkhb

2 of 2 counted attempts passed. 7s wall time. Tokens: not reported. Cost: not reported.

Run `20261108T133503Z_nogit_cursor-agent_rkhb` by cursor-agent, 2026-11-08, reeval 0.22.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - canary: 1 counted attempt reported no token usage; token medians omit them. [A1](#attempt-evals-canary-eval-ts-canary-fake-open-boat-68c24521-1-ab349ef7)
> - lands: 1 counted attempt reported no token usage; token medians omit them. [A2](#attempt-evals-lands-eval-ts-lands-fake-closed-boat-68c24521-1-474983e7)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 2 attempts |

## canary

`evals/canary.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](#attempt-evals-canary-eval-ts-canary-fake-open-boat-68c24521-1-ab349ef7) | Fake | pass | not reported | 97ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toMatch /^000 exit=[1-9]\d*$/ | toMatch | evals/canary.eval.ts:7 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | 0.1s | not reported | not reported |

## lands

`evals/lands.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A2](#attempt-evals-lands-eval-ts-lands-fake-closed-boat-68c24521-1-474983e7) | Fake | pass | not reported | 72ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toEqual ["baked-by-boat-image","reeval"] | toEqual | evals/lands.eval.ts:8 | 1 of 1 | 1 of 1 |
| toMatch /^000 exit=[1-9]\d*$/ | toMatch | evals/lands.eval.ts:9 | 1 of 1 | 1 of 1 |
| not.toBe 200 | not.toBe | evals/lands.eval.ts:10 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | 0.1s | not reported | not reported |

## Tally

Evals: 2 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Resources | boat small 4 vCPU 15.6 GiB: 2 attempts · CPU 0.2 s (avg 0.24, peak 0.23 cores) · memory peak 27 MiB |
| Environments | closed 62b9fdc93469; open c689fe3f6893 |
| Judge | none by default · threshold 0.8 · version 2443ca66db9b |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.16 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.16 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.9 · @ai-sdk/harness-claude-code 1.0.176-patch.a9d56a8c · @reeval/harness-codex 0.1.13 · @reeval/harness-fx 0.1.11 · @reeval/harness-grok-build 0.1.12 · ai 7.0.161 · @ai-sdk/harness 1.0.172 · @ai-sdk/anthropic 4.0.95 · @ai-sdk/google 4.0.110 · @ai-sdk/openai 4.0.107 · @ai-sdk/typesafe-ai 3.0.32 |
| reeval | 0.22.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | failures |

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-canary-eval-ts-canary-fake-open-boat-68c24521-1-ab349ef7"></a>A1 | canary | Fake | pass | not reported | 97ms | 1 | not recorded | n/a |
| <a id="attempt-evals-lands-eval-ts-lands-fake-closed-boat-68c24521-1-474983e7"></a>A2 | lands | Fake | pass | not reported | 72ms | 1 | not recorded | n/a |
