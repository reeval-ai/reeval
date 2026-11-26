# Run 20261126T053204Z_148a262_cursor-agent_zrrg

1 of 2 counted attempts passed. 1s wall time. No USD cost recorded. 148a262.

Run `20261126T053204Z_148a262_cursor-agent_zrrg` by cursor-agent, 2026-11-26, reeval 0.31.0, 1 run per cell.

> [!WARNING]
> Integrity: read these before the results.
>
> - 1 counted attempt reported no token usage; token medians omit them. [A1](./graded-a20f6f/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - 1 counted attempt reported no token usage; token medians omit them. [A2](./reference-answer-4856a8/fake-fake-fake-dc13e2/1/diff.patch)

## Summary

| Evaluation | Shape / arms | Primary result | Effort |
| --- | --- | --- | --- |
| [graded](#graded) | task; 1 coding harness, 1 attempt | Median tokens: not reported | not reported |
| [reference](#reference) | task; 1 coding harness, 1 attempt | Median tokens: not reported | not reported |

## graded

`evals/graded.eval.ts`. Task. 1 coding harness, 1 attempt.

**Median tokens: not reported**

No attempt reported usage.

### Failures and caveats

| Kind | Label | At | Count | Attempts |
| --- | --- | --- | --- | --- |
| error | score 0.95 below 1: judge:How readable is the change? scored 0.75 | n/a | 1 of 1 | [A1](./graded-a20f6f/fake-fake-fake-dc13e2/1/transcript.jsonl) |

## reference

`evals/reference.eval.ts`. Task. 1 coding harness, 1 attempt.

**Median tokens: not reported**

No attempt reported usage.

## State

| Field | Value |
| --- | --- |
| Executed at | 148a262c552f on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Agents | fake |
| Environments | fake eca09e8f139f |
| Judge | none by default · threshold 0.8 · version 1f259248a52c |
| Packages | @vitest/expect 5.1.0 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.17 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.17 · @reeval/harness-pi 0.2.10 · @reeval/harness-cursor-sdk 0.1.9 … |
| reeval | 0.31.0 · node 26.13.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | evidence |
| Record | [20261126T053204Z_148a262_cursor-agent_zrrg.json](../20261126T053204Z_148a262_cursor-agent_zrrg.json) |

## Attempt index

| ID | Eval | Coding harness | Arm / Case | Outcome | Tokens | Agent time | Tools | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-graded-fake-fake-fake-1-1fd225a3"></a>A1 | graded | fake | fake | fail | not reported | 1ms | 0 | 1 files, +1 / -0 | [transcript](./graded-a20f6f/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./graded-a20f6f/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-reference-answer-fake-fake-fake-1-7b1e07ba"></a>A2 | reference | fake | fake / answer | pass | not reported | 1ms | 0 | 1 files, +1 / -0 | [diff](./reference-answer-4856a8/fake-fake-fake-dc13e2/1/diff.patch) |
