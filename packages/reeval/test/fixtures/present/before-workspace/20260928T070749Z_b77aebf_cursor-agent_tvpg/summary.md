# takes its time

The run stopped early (budget reached).

3 of 3 counted attempts passed. 2s wall time. Tokens: not reported. Cost: not reported. b77aebf.

Run `20260928T070749Z_b77aebf_cursor-agent_tvpg` by cursor-agent, 2026-09-28, reeval 0.0.1, profile `budget`, 4 runs per cell.

> [!CAUTION]
> Read these before the results.
>
> - Run stopped early (budget); pass rates and medians cover only the attempts that finished.
> - 3 counted attempts reported no token usage; token medians omit them. [A1](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/1/transcript.jsonl), [A2](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/2/transcript.jsonl), [A3](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/3/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| slow | n/a | n/a | 3 attempts |

`evals/slow.es.ts`. Task. 1 coding harness, 3 attempts. Verdict: pass.

**100% passed**

3 of 3 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/1/transcript.jsonl) | slow | pass | not reported | 403ms | not reported | n/a |
| [A2](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/2/transcript.jsonl) | slow | pass | not reported | 402ms | not reported | n/a |
| [A3](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/3/transcript.jsonl) | slow | pass | not reported | 402ms | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | 0.4s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | b77aebfde82e on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | slow |
| Environments | none |
| Judge | fake · threshold 0.8 · version 6334f0ba15cf |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @evalsuite/harness-antigravity 0.1.0 · @evalsuite/harness-opencode 0.1.0 · @evalsuite/harness-goose 0.1.0 · @evalsuite/harness-pi 0.1.0 · @evalsuite/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @evalsuite/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 22.14.0 · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-slow-es-ts-takes-its-time-slow-fake-1-7649ae41"></a>A1 | takes its time | slow | pass | not reported | 403ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/1/transcript.jsonl), [diff](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/1/diff.patch) |
| <a id="attempt-evals-slow-es-ts-takes-its-time-slow-fake-2-89cdab4b"></a>A2 | takes its time | slow | pass | not reported | 402ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/2/transcript.jsonl), [diff](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/2/diff.patch) |
| <a id="attempt-evals-slow-es-ts-takes-its-time-slow-fake-3-bb5783e0"></a>A3 | takes its time | slow | pass | not reported | 402ms | 0 | 1 file (lines not recorded) | [transcript](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/3/transcript.jsonl), [diff](./evals-slow-es-ts-takes-its-time-312574/slow-fake-daf0c8/3/diff.patch) |
