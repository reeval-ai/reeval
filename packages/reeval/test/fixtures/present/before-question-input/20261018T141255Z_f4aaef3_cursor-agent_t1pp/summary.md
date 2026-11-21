# takes its time

The run stopped early (budget reached).

2 of 2 counted attempts passed. 4s wall time. Tokens: not reported. Cost: not reported. f4aaef3.

Run `20261018T141255Z_f4aaef3_cursor-agent_t1pp` by cursor-agent, 2026-10-18, reeval 0.9.0, profile `budget`, 4 runs per cell.

> [!CAUTION]
> Read these before the results.
>
> - Run stopped early (budget); pass rates and medians cover only the attempts that finished.
> - 2 counted attempts reported no token usage; token medians omit them. [A1](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/transcript.jsonl), [A2](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| slow | n/a | n/a | 2 attempts |

`evals/slow.eval.ts`. Task. 1 coding harness, 2 attempts. Verdict: pass.

**100% passed**

2 of 2 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/transcript.jsonl) | slow | pass | not reported | 409ms | not reported | n/a |
| [A2](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/transcript.jsonl) | slow | pass | not reported | 408ms | not reported | n/a |

### Checks

| Check | Matcher | At | slow | Total |
| --- | --- | --- | --- | --- |
| toSucceed test -f greet.js | toSucceed | n/a | 2 of 2 | 2 of 2 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | 0.4s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | f4aaef3453cf on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | slow |
| Environments | fake eca09e8f139f |
| Judge | fake · threshold 0.8 · version c333ac5c17b5 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.8 · @reeval/harness-opencode 0.2.8 · @reeval/harness-goose 0.1.3 · @reeval/harness-pi 0.2.7 · @reeval/harness-cursor-sdk 0.1.5 · @ai-sdk/harness-claude-code 1.0.152-patch.8edc594f · @reeval/harness-codex 0.1.7 · ai 7.0.140 · @ai-sdk/harness 1.0.148 · @ai-sdk/google 4.0.93 · @ai-sdk/typesafe-ai 3.0.18 |
| reeval | 0.9.0 · node 22.14.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-slow-eval-ts-takes-its-time-slow-fake-fake-1-da1dd5f7"></a>A1 | takes its time | slow | pass | not reported | 409ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/transcript.jsonl), [diff](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/diff.patch) |
| <a id="attempt-evals-slow-eval-ts-takes-its-time-slow-fake-fake-2-f322653a"></a>A2 | takes its time | slow | pass | not reported | 408ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/transcript.jsonl), [diff](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/diff.patch) |
