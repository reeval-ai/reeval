# Run 20261126T013500Z_35e24f2_cursor-agent_6p3v

1 of 1 counted attempts passed, 1 infra errors. 1s wall time. No USD cost recorded. 35e24f2.

Run `20261126T013500Z_35e24f2_cursor-agent_6p3v` by cursor-agent, 2026-11-26, reeval 0.31.0, 1 run per cell.

> [!WARNING]
> Integrity: read these before the results.
>
> - 1 counted attempt reported no token usage; token medians omit them. [A2](./decide-5589aa/fake-fake-fake-dc13e2/1/transcript.jsonl)

## Summary

| Evaluation | Shape / arms | Primary result | Effort |
| --- | --- | --- | --- |
| [decide](#decide) | task; 1 coding harness, 1 attempt | Median tokens: not reported | not reported |
| [outage](#outage) | task; 1 coding harness, 1 attempt | Median tokens: not reported | not reported |

## decide

`evals/decide.eval.ts`. Task. 1 coding harness, 1 attempt.

**Median tokens: not reported**

No attempt reported usage.

## outage

`evals/outage.eval.ts`. Task. 1 coding harness, 1 attempt.

**Median tokens: not reported**

No attempt reported usage.

### Failures and caveats

| Kind | Label | At | Count | Attempts |
| --- | --- | --- | --- | --- |
| infra-error | c.decide() with fake/fake-decision failed: overloaded. Set decide.model in reeval.config.ts to a decision model that answers, or pass { model } to the call. | n/a | 1 of 1 | [A1](./outage-4398c2/fake-fake-fake-dc13e2/1/transcript.jsonl) |

## State

| Field | Value |
| --- | --- |
| Executed at | 35e24f2978fb on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Agents | fake |
| Environments | fake eca09e8f139f |
| Judge | none by default · threshold 0.8 · version 1f259248a52c |
| Packages | @vitest/expect 5.1.0 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.17 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.17 · @reeval/harness-pi 0.2.10 · @reeval/harness-cursor-sdk 0.1.9 … |
| reeval | 0.31.0 · node 26.13.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Record | [20261126T013500Z_35e24f2_cursor-agent_6p3v.json](../20261126T013500Z_35e24f2_cursor-agent_6p3v.json) |

## Attempt index

| ID | Eval | Coding harness | Arm / Case | Outcome | Tokens | Agent time | Tools | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-outage-fake-fake-fake-1-3478b863"></a>A1 | outage | fake | fake | infra_error | not reported | 1ms | 0 | 1 files, +1 / -0 | [transcript](./outage-4398c2/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./outage-4398c2/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-decide-fake-fake-fake-1-23426e6d"></a>A2 | decide | fake | fake | pass | not reported | 2ms | 0 | 2 files, +2 / -0 | [transcript](./decide-5589aa/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./decide-5589aa/fake-fake-fake-dc13e2/1/diff.patch) |
