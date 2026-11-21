# writes hello

1 of 1 counted attempt passed. 16s wall time. Tokens: 65k. Cost: not reported. 9c5124c.

Run `20260929T034615Z_9c5124c_runner_8r0z` by runner, 2026-09-29, reeval 0.0.1, 1 run per cell.

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Claude Code · claude-haiku-4-5 | n/a | n/a | 1 attempt |

`evals/hello.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-hello-eval-ts-writes-hello-98d896/claude-code-claude-haiku-4-5-docker-cd4e2d/1/transcript.jsonl) | Claude Code · claude-haiku-4-5 | pass | 65k | 6s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 65k | 0 | 6.3s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | 9c5124c46c0d on main, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:claude-code-1.0.128-patch.5d1c985c · id 13db7c0f24b7 · no registry digest (built locally) · CLI 2.1.276 (Claude Code) |
| Harnesses | claude-code:claude-haiku-4-5 (model claude-haiku-4-5, served claude-haiku-4-5) |
| Environments | none |
| Judge | none by default · threshold 0.8 · version 0e2a4839495b |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.0 · @reeval/harness-opencode 0.2.0 · @reeval/harness-goose 0.1.0 · @reeval/harness-pi 0.1.0 · @reeval/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @reeval/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 24.21.0 · linux/x64 |
| Runner | local · runner |
| Artifacts | all |
| Context | 1 file |

> **Warning:** Image reeval-sandbox:claude-code-1.0.128-patch.5d1c985c isn't pushed, so an exact rerun needs this machine's image (id 13db7c0f24b7).

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-hello-eval-ts-writes-hello-claude-code-claude-haiku-4-1fb6891f"></a>A1 | writes hello | Claude Code · claude-haiku-4-5 | pass | 65k | 6s | 0 | 1 file (lines not recorded) | [transcript](./evals-hello-eval-ts-writes-hello-98d896/claude-code-claude-haiku-4-5-docker-cd4e2d/1/transcript.jsonl), [diff](./evals-hello-eval-ts-writes-hello-98d896/claude-code-claude-haiku-4-5-docker-cd4e2d/1/diff.patch) |
