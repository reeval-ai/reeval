# slow install

1 of 2 counted attempts passed. 2m 00s wall time. Tokens: 220k. Cost: not reported.

Run `20261105T124838Z_nogit_cursor-agent_bxp9` by cursor-agent, 2026-11-05, reeval 0.20.0, 1 run per cell.

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Cursor · composer-2.5 | n/a | n/a | 1 attempt |
| Claude Code · claude-sonnet-5 | n/a | n/a | 1 attempt |

`probe.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**50% passed**

1 of 2 attempts · Cursor · composer-2.5 1 of 1, Claude Code · claude-sonnet-5 0 of 1.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./probe-eval-ts-slow-install-d3cb47/cursor-composer-2-5-probe-docker-91f80e/1/transcript.jsonl) | Cursor · composer-2.5 | pass | 79k | 1m 55s | not reported | n/a |
| [A2](./probe-eval-ts-slow-install-d3cb47/claude-code-claude-sonnet-5-probe-docker-ec3e0a/1/transcript.jsonl) | Claude Code · claude-sonnet-5 | fail | 141k | 10s | not reported | done: expected file done.txt to exist |

### Checks

| Check | Matcher | At | Cursor · composer-2.5 | Claude Code · claude-sonnet-5 | Total |
| --- | --- | --- | --- | --- | --- |
| done | toHaveFile | probe.eval.ts:9 | 1 of 1 | 0 of 1 | 1 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | done | expected file done.txt to exist | probe.eval.ts:9 | 1 of 2, all on Claude Code · claude-sonnet-5 | [A2](./probe-eval-ts-slow-install-d3cb47/claude-code-claude-sonnet-5-probe-docker-ec3e0a/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| Cursor · composer-2.5 | 79k | 7 | 1m 55s | not reported | not reported |
| Claude Code · claude-sonnet-5 | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## Tally

Evals: 1 fail.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:claude-code-1.0.176-patch.8c0f3055 · id cd3405361df9 · no registry digest (built locally) · CLI 2.1.290 (Claude Code); reeval-sandbox:cursor-0.1.8 · id b0a86c781741 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | claude-code:claude-sonnet-5 (model claude-sonnet-5, reasoning effort medium, served claude-sonnet-5), cursor:composer-2.5 (model composer-2.5, served composer-2.5[fast=false]) |
| Environments | probe 63ac57a5ab47 |
| Judge | none by default · threshold 0.8 · version 4ad59c27538d |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.15 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.14 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.8 · @ai-sdk/harness-claude-code 1.0.176-patch.8c0f3055 · @reeval/harness-codex 0.1.12 · @reeval/harness-fx 0.1.9 · @reeval/harness-grok-build 0.1.11 · ai 7.0.161 · @ai-sdk/harness 1.0.172 · @ai-sdk/anthropic 4.0.95 · @ai-sdk/google 4.0.110 · @ai-sdk/openai 4.0.107 · @ai-sdk/typesafe-ai 3.0.32 |
| reeval | 0.20.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Context | 2 files |

> **Warning:** Image reeval-sandbox:claude-code-1.0.176-patch.8c0f3055 isn't pushed, so an exact rerun needs this machine's image (id cd3405361df9).

> **Warning:** Image reeval-sandbox:cursor-0.1.8 isn't pushed, so an exact rerun needs this machine's image (id b0a86c781741).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-probe-eval-ts-slow-install-cursor-composer-2-5-probe-docker-646cea08"></a>A1 | slow install | Cursor · composer-2.5 | pass | 79k | 1m 55s | 7 | 1 file (lines not recorded) | [transcript](./probe-eval-ts-slow-install-d3cb47/cursor-composer-2-5-probe-docker-91f80e/1/transcript.jsonl), [diff](./probe-eval-ts-slow-install-d3cb47/cursor-composer-2-5-probe-docker-91f80e/1/diff.patch), [snapshot](./probe-eval-ts-slow-install-d3cb47/cursor-composer-2-5-probe-docker-91f80e/1/snapshots/final) |
| <a id="attempt-probe-eval-ts-slow-install-claude-code-claude-sonnet-5-probe-6026a4d5"></a>A2 | slow install | Claude Code · claude-sonnet-5 | fail | 141k | 10s | 4 | not recorded | [transcript](./probe-eval-ts-slow-install-d3cb47/claude-code-claude-sonnet-5-probe-docker-ec3e0a/1/transcript.jsonl), [diff](./probe-eval-ts-slow-install-d3cb47/claude-code-claude-sonnet-5-probe-docker-ec3e0a/1/diff.patch), [snapshot](./probe-eval-ts-slow-install-d3cb47/claude-code-claude-sonnet-5-probe-docker-ec3e0a/1/snapshots/final) |
