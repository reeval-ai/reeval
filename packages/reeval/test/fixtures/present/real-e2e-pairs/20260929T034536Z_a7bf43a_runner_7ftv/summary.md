# writes hello

1 of 1 counted attempt passed. 11s wall time. Tokens: 27k. Cost: not reported. a7bf43a.

Run `20260929T034536Z_a7bf43a_runner_7ftv` by runner, 2026-09-29, reeval 0.0.1, 1 run per cell.

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Cursor · composer-2.5 | n/a | n/a | 1 attempt |

`evals/hello.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-hello-eval-ts-writes-hello-98d896/cursor-composer-2-5-docker-76739b/1/transcript.jsonl) | Cursor · composer-2.5 | pass | 27k | 7s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 27k | 0 | 6.6s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | a7bf43aa4ac4 on main, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.0 · id 117b7f5d33a3 · no registry digest (built locally) · CLI @cursor/sdk 1.0.32 |
| Harnesses | cursor:composer-2.5 (model composer-2.5, served composer-2.5[fast=false]) |
| Environments | none |
| Judge | none by default · threshold 0.8 · version 0e2a4839495b |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.0 · @reeval/harness-opencode 0.2.0 · @reeval/harness-goose 0.1.0 · @reeval/harness-pi 0.1.0 · @reeval/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @reeval/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 24.21.0 · linux/x64 |
| Runner | local · runner |
| Artifacts | all |
| Context | 1 file |

> **Warning:** Image reeval-sandbox:cursor-0.1.0 isn't pushed, so an exact rerun needs this machine's image (id 117b7f5d33a3).

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-hello-eval-ts-writes-hello-cursor-composer-2-5-docker-04440cdf"></a>A1 | writes hello | Cursor · composer-2.5 | pass | 27k | 7s | 0 | 1 file (lines not recorded) | [transcript](./evals-hello-eval-ts-writes-hello-98d896/cursor-composer-2-5-docker-76739b/1/transcript.jsonl), [diff](./evals-hello-eval-ts-writes-hello-98d896/cursor-composer-2-5-docker-76739b/1/diff.patch) |
