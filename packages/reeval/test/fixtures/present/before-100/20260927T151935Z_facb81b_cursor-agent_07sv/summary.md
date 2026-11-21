# Run 20260927T151935Z_facb81b_cursor-agent_07sv

1 of 1 counted attempt passed. 740ms wall time. Tokens: not reported. Cost: not reported. facb81b.

Run `20260927T151935Z_facb81b_cursor-agent_07sv` by cursor-agent, 2026-09-27, reeval 0.0.1, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 1 attempt |

## writes greet.js

`evals/greet.es.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 1ms | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## greets in French

`evals/greet.es.ts`. Task. 1 coding harness, 0 attempts. Verdict: skipped.

## Tally

Evals: 1 pass · 1 skipped.

## State

| Field | Value |
| --- | --- |
| Executed at | facb81bea2e0 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | none |
| Judge | none by default · threshold 0.8 · version 0e2a4839495b |
| Packages | vitest 5.0.2 · @evalsuite/harness-antigravity 0.1.0 · @evalsuite/harness-opencode 0.1.0 · @evalsuite/harness-goose 0.1.0 · @evalsuite/harness-pi 0.1.0 · @evalsuite/harness-cursor-sdk 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/harness-claude-code 1.0.128 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 22.14.0 · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-greet-es-ts-writes-greet-js-fake-fake-1-4db1d21c"></a>A1 | writes greet.js | Fake | pass | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/diff.patch) |
