# edits through a subagent

3 of 3 counted attempts passed. 38s wall time. Tokens: 179k. Cost: not reported. d5250ae (dirty).

Run `20261030T141230Z_d5250ae_cursor-agent_3f2e` by cursor-agent, 2026-10-30, reeval 0.17.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - The worktree was dirty; an exact rerun needs the saved worktree patch.

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Cursor · composer-2.5 | n/a | n/a | 1 attempt |
| Claude Code · claude-sonnet-5[effort=medium] | n/a | n/a | 1 attempt |
| Codex · gpt-5.6-luna[effort=medium] | n/a | n/a | 1 attempt |

`subagent.eval.ts`. Task. 3 coding harnesses, 3 attempts. Verdict: pass.

**100% passed**

3 of 3 attempts · Cursor · composer-2.5 1 of 1, Claude Code · claude-sonnet-5[effort=medium] 1 of 1, Codex · gpt-5.6-luna[effort=medium] 1 of 1.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./subagent-eval-ts-edits-through-a-subagent-8d6785/cursor-composer-2-5-puzzle-docker-e8df09/1/transcript.jsonl) | Cursor · composer-2.5 | pass | 39k | 21s | not reported | n/a |
| [A2](./subagent-eval-ts-edits-through-a-subagent-8d6785/claude-code-claude-sonnet-5-effort-medium-puzzle-docker-f3d2d8/1/transcript.jsonl) | Claude Code · claude-sonnet-5[effort=medium] | pass | 88k | 29s | not reported | n/a |
| [A3](./subagent-eval-ts-edits-through-a-subagent-8d6785/codex-gpt-5-6-luna-effort-medium-puzzle-docker-e17139/1/transcript.jsonl) | Codex · gpt-5.6-luna[effort=medium] | pass | 53k | 34s | not reported | n/a |

### Checks

| Check | Matcher | At | Cursor · composer-2.5 | Claude Code · claude-sonnet-5[effort=medium] | Codex · gpt-5.6-luna[effort=medium] | Total |
| --- | --- | --- | --- | --- | --- | --- |
| toHaveFile src/NOTES.md | toHaveFile | subagent.eval.ts:11 | 1 of 1 | 1 of 1 | 1 of 1 | 3 of 3 |
| toSucceed node --test | toSucceed | subagent.eval.ts:12 | 1 of 1 | 1 of 1 | 1 of 1 | 3 of 3 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| Cursor · composer-2.5 | 39k | 4 | 21s | not reported | not reported |
| Claude Code · claude-sonnet-5[effort=medium] | 88k | 2 | 29s | not reported | not reported |
| Codex · gpt-5.6-luna[effort=medium] | 53k | 0 | 34s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | d5250aebfbd1 on master, dirty (the commit that adds this record is later) |
| Uncommitted | worktree.patch, 1412 bytes, sha256 ae3b4bbf1a17 |
| Lockfiles | none found |
| Images | reeval-sandbox:claude-code-1.0.160-patch.b17cde50 · id d0bc5fdb87ef · no registry digest (built locally) · CLI 2.1.290 (Claude Code); reeval-sandbox:codex-0.1.9 · id f37261760bb0 · no registry digest (built locally) · CLI codex-cli 0.164.0; reeval-sandbox:cursor-0.1.6 · id 8b097c3caae2 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | claude-code:claude-sonnet-5[effort=medium] (model claude-sonnet-5, reasoning effort medium, served claude-sonnet-5), codex:gpt-5.6-luna[effort=medium] (model gpt-5.6-luna, reasoning effort medium, served gpt-5.6-luna[effort=medium], served reasoning effort medium), cursor:composer-2.5 (model composer-2.5, served composer-2.5[fast=false]) |
| Environments | puzzle ec5f055e81dd |
| Judge | none by default · threshold 0.8 · version b7a490837586 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.12 · @reeval/harness-opencode 0.2.11 · @reeval/harness-goose 0.1.8 · @reeval/harness-pi 0.2.8 · @reeval/harness-cursor-sdk 0.1.6 · @ai-sdk/harness-claude-code 1.0.160-patch.b17cde50 · @reeval/harness-codex 0.1.9 · @reeval/harness-fx 0.1.3 · @reeval/harness-grok-build 0.1.6 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/anthropic 4.0.83 · @ai-sdk/google 4.0.100 · @ai-sdk/openai 4.0.97 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.17.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Context | 52 files |

> **Warning:** Image reeval-sandbox:claude-code-1.0.160-patch.b17cde50 isn't pushed, so an exact rerun needs this machine's image (id d0bc5fdb87ef).

> **Warning:** Image reeval-sandbox:codex-0.1.9 isn't pushed, so an exact rerun needs this machine's image (id f37261760bb0).

> **Warning:** Image reeval-sandbox:cursor-0.1.6 isn't pushed, so an exact rerun needs this machine's image (id 8b097c3caae2).

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-subagent-eval-ts-edits-through-a-subagent-cursor-composer-2-244070ff"></a>A1 | edits through a subagent | Cursor · composer-2.5 | pass | 39k | 21s | 4 | 2 files (lines not recorded) | [transcript](./subagent-eval-ts-edits-through-a-subagent-8d6785/cursor-composer-2-5-puzzle-docker-e8df09/1/transcript.jsonl), [diff](./subagent-eval-ts-edits-through-a-subagent-8d6785/cursor-composer-2-5-puzzle-docker-e8df09/1/diff.patch) |
| <a id="attempt-subagent-eval-ts-edits-through-a-subagent-claude-code-claude-2d7ee35b"></a>A2 | edits through a subagent | Claude Code · claude-sonnet-5[effort=medium] | pass | 88k | 29s | 2 | 2 files (lines not recorded) | [transcript](./subagent-eval-ts-edits-through-a-subagent-8d6785/claude-code-claude-sonnet-5-effort-medium-puzzle-docker-f3d2d8/1/transcript.jsonl), [diff](./subagent-eval-ts-edits-through-a-subagent-8d6785/claude-code-claude-sonnet-5-effort-medium-puzzle-docker-f3d2d8/1/diff.patch) |
| <a id="attempt-subagent-eval-ts-edits-through-a-subagent-codex-gpt-5-6-luna-fcaea43f"></a>A3 | edits through a subagent | Codex · gpt-5.6-luna[effort=medium] | pass | 53k | 34s | 0 | 2 files (lines not recorded) | [transcript](./subagent-eval-ts-edits-through-a-subagent-8d6785/codex-gpt-5-6-luna-effort-medium-puzzle-docker-e17139/1/transcript.jsonl), [diff](./subagent-eval-ts-edits-through-a-subagent-8d6785/codex-gpt-5-6-luna-effort-medium-puzzle-docker-e17139/1/diff.patch) |
