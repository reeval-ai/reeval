# takes its time

The run stopped early (budget reached).

3 of 3 counted attempts passed. 3s wall time. Tokens: not reported. Cost: not reported. 122fc2e.

Run `20261025T201356Z_122fc2e_cursor-agent_3jxt` by cursor-agent, 2026-10-25, reeval 0.14.0, profile `budget`, 4 runs per cell.

> [!CAUTION]
> Read these before the results.
>
> - Run stopped early (budget); pass rates and medians cover only the attempts that finished.
> - 3 counted attempts reported no token usage; token medians omit them. [A1](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/transcript.jsonl), [A2](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/transcript.jsonl), [A3](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/3/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| slow | n/a | n/a | 3 attempts |

`evals/slow.eval.ts`. Task. 1 coding harness, 3 attempts. Verdict: pass.

**100% passed**

3 of 3 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/transcript.jsonl) | slow | pass | not reported | 403ms | not reported | n/a |
| [A2](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/transcript.jsonl) | slow | pass | not reported | 402ms | not reported | n/a |
| [A3](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/3/transcript.jsonl) | slow | pass | not reported | 402ms | not reported | n/a |

### Checks

| Check | Matcher | At | slow | Total |
| --- | --- | --- | --- | --- |
| toSucceed test -f greet.js | toSucceed | n/a | 3 of 3 | 3 of 3 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | 0.4s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | 122fc2ecb56a on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | slow |
| Environments | fake eca09e8f139f |
| Judge | fake · threshold 0.8 · version 27640d239cb8 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.12 · @reeval/harness-opencode 0.2.10 · @reeval/harness-goose 0.1.6 · @reeval/harness-pi 0.2.8 · @reeval/harness-cursor-sdk 0.1.6 · @ai-sdk/harness-claude-code 1.0.160-patch.b17cde50 · @reeval/harness-codex 0.1.9 · @reeval/harness-fx 0.1.1 · @reeval/harness-grok-build 0.1.5 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/anthropic 4.0.83 · @ai-sdk/google 4.0.100 · @ai-sdk/openai 4.0.97 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.14.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-slow-eval-ts-takes-its-time-slow-fake-fake-1-da1dd5f7"></a>A1 | takes its time | slow | pass | not reported | 403ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/transcript.jsonl), [diff](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/1/diff.patch) |
| <a id="attempt-evals-slow-eval-ts-takes-its-time-slow-fake-fake-2-f322653a"></a>A2 | takes its time | slow | pass | not reported | 402ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/transcript.jsonl), [diff](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/2/diff.patch) |
| <a id="attempt-evals-slow-eval-ts-takes-its-time-slow-fake-fake-3-357f63c3"></a>A3 | takes its time | slow | pass | not reported | 402ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/3/transcript.jsonl), [diff](./evals-slow-eval-ts-takes-its-time-c5b2d3/slow-fake-fake-51603b/3/diff.patch) |
