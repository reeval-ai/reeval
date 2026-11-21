# writes hello

1 of 1 counted attempt passed. 6s wall time. Tokens: 21k. Cost: not reported. 65c2a1b.

Run `20260929T034907Z_65c2a1b_runner_yht6` by runner, 2026-09-29, reeval 0.0.1, 1 run per cell.

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Codex · gpt-5.4-mini | n/a | n/a | 1 attempt |

`evals/hello.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-hello-eval-ts-writes-hello-98d896/codex-gpt-5-4-mini-docker-afcfca/1/transcript.jsonl) | Codex · gpt-5.4-mini | pass | 21k | 3s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 21k | 0 | 2.7s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | 65c2a1b1748e on main, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:codex-0.1.0 · id 1b03c464ad8c · no registry digest (built locally) · CLI codex-cli 0.157.1 |
| Harnesses | codex:gpt-5.4-mini (model gpt-5.4-mini, served gpt-5.4-mini-2026-03-17[effort=medium]) |
| Environments | none |
| Judge | none by default · threshold 0.8 · version 0e2a4839495b |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.0 · @reeval/harness-opencode 0.2.0 · @reeval/harness-goose 0.1.0 · @reeval/harness-pi 0.1.0 · @reeval/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @reeval/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 24.21.0 · linux/x64 |
| Runner | local · runner |
| Artifacts | all |
| Context | 62 files |

> **Warning:** Image reeval-sandbox:codex-0.1.0 isn't pushed, so an exact rerun needs this machine's image (id 1b03c464ad8c).

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-hello-eval-ts-writes-hello-codex-gpt-5-4-mini-docker-1-812d3330"></a>A1 | writes hello | Codex · gpt-5.4-mini | pass | 21k | 3s | 0 | 1 file (lines not recorded) | [transcript](./evals-hello-eval-ts-writes-hello-98d896/codex-gpt-5-4-mini-docker-afcfca/1/transcript.jsonl), [diff](./evals-hello-eval-ts-writes-hello-98d896/codex-gpt-5-4-mini-docker-afcfca/1/diff.patch) |
