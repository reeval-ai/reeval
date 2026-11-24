# subagents

1 of 1 counted attempts passed. 14s wall time. 57k tokens (28k cache reads). agent $0.12.

Run `20261124T104511Z_nogit_cursor-agent_a1qs` by cursor-agent, 2026-11-24, reeval 0.31.0, profile `claude-code`, 1 run per cell.

`spike.eval.ts`. Task. 1 coding harness, 1 attempt.

**100% passed**

1 of 1 counted attempts passed on all 2 assertions. 1 coding harness.

## Assertions

| Assertion | Matcher | claude-code:claude-sonnet-5 | Total |
| --- | --- | --- | --- |
| add | toHaveFile | 1 of 1 | 1 of 1 |
| mul | toHaveFile | 1 of 1 | 1 of 1 |

## By Coding harness

| Coding harness | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| claude-code:claude-sonnet-5 | 100% | 57k | 3 | 1 | $0.12 | 9.6s | 2 | 2 | 0 |

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:claude-code-1.0.176-patch.423f52e6 · id 839e3cd34b2d · no registry digest (built locally) · CLI 2.1.290 (Claude Code) |
| Harnesses | claude-code:claude-sonnet-5 (model claude-sonnet-5, reasoning effort medium, served claude-sonnet-5) |
| Resources | docker 2 vCPU 4.0 GiB: 1 attempt · CPU 2.0 s (avg 0.18, peak 0.44 cores) · memory peak 223 MiB |
| Environments | puzzle f7226e524714 |
| Judge | none by default · threshold 0.8 · version 1f259248a52c |
| Packages | @vitest/expect 5.1.0 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.17 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.17 · @reeval/harness-pi 0.2.10 · @reeval/harness-cursor-sdk 0.1.9 … |
| reeval | 0.31.0 · node 26.13.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Record | [20261124T104511Z_nogit_cursor-agent_a1qs.json](../20261124T104511Z_nogit_cursor-agent_a1qs.json) |
| Context | 1 files |

| Path | sha256 |
| --- | --- |
| ~/.claude/skills/.ai-sdk-harness-skills.json | 5ddf48ce4d70 |

> **Warning:** Image reeval-sandbox:claude-code-1.0.176-patch.423f52e6 isn't pushed, so an exact rerun needs this machine's image (id 839e3cd34b2d).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Arm / Case | Outcome | Tokens | Agent time | Tools | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-spike-eval-ts-subagents-claude-code-claude-sonnet-5-puzzle-d-29605568"></a>A1 | spike.eval.ts › subagents | claude-code:claude-sonnet-5 | puzzle | pass | 57k | 10s | 3 | 2 files, +2 / -0 | [transcript](./spike-eval-ts-subagents-c4f85d/claude-code-claude-sonnet-5-puzzle-docker-05890c/1/transcript.jsonl), [diff](./spike-eval-ts-subagents-c4f85d/claude-code-claude-sonnet-5-puzzle-docker-0… |
