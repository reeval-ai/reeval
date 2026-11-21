# Run 20260929T033538Z_nogit_runner_f3z3

6 of 12 counted attempts passed. 1m 45s wall time. Tokens: 326k. Cost: not reported.

Run `20260929T033538Z_nogit_runner_f3z3` by runner, 2026-09-29, reeval 0.0.1, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - edit and run canary: 1 counted attempt reported no token usage; token medians omit them. [A2](#attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-claude-code-c-3f0d7c3a)
> - egress canary: 1 counted attempt reported no token usage; token medians omit them. [A4](#attempt-evals-egress-eval-ts-egress-canary-claude-code-claude-haiku-76ab9e2e)
> - key canary: 1 counted attempt reported no token usage; token medians omit them. [A6](#attempt-evals-key-eval-ts-key-canary-claude-code-claude-haiku-4-5-pl-a835233c)
> - mcp canary: 1 counted attempt reported no token usage; token medians omit them. [A8](#attempt-evals-mcp-eval-ts-mcp-canary-claude-code-claude-haiku-4-5-st-d0a1c32e)
> - rules canary: 1 counted attempt reported no token usage; token medians omit them. [A10](#attempt-evals-rules-eval-ts-rules-canary-claude-code-claude-haiku-4-707ef0ba)
> - skill canary: 1 counted attempt reported no token usage; token medians omit them. [A12](#attempt-evals-skill-eval-ts-skill-canary-claude-code-claude-haiku-4-bc259512)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Claude Code · claude-haiku-4-5 | n/a | n/a | 12 attempts |

## edit and run

`evals/edit-and-run.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-edit-and-run-eval-ts-edit-and-run-db761a/claude-code-claude-haiku-4-5-notes-docker-13c892/1/transcript.jsonl) | Claude Code · claude-haiku-4-5 | pass | 87k | 8s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 87k | 2 | 8.3s | not reported | not reported |

## edit and run canary

`evals/edit-and-run.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A2](#attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-claude-code-c-3f0d7c3a) | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | not reported | expected 'status: draft' to be 'status: final' // Object.is equality |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected 'status: draft' to be 'status: final' // Object.is equality | n/a | n/a | 1 of 1 | [A2](#attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-claude-code-c-3f0d7c3a) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## egress

`evals/egress.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A3](./evals-egress-eval-ts-egress-ae6df0/claude-code-claude-haiku-4-5-closed-docker-57fce2/1/transcript.jsonl) | Claude Code · claude-haiku-4-5 | pass | 44k | 8s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 44k | 1 | 8.3s | not reported | not reported |

## egress canary

`evals/egress.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A4](#attempt-evals-egress-eval-ts-egress-canary-claude-code-claude-haiku-76ab9e2e) | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | not reported | expected '403 000' to match /^200 / |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected '403 000' to match /^200 / | n/a | n/a | 1 of 1 | [A4](#attempt-evals-egress-eval-ts-egress-canary-claude-code-claude-haiku-76ab9e2e) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## key

`evals/key.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./evals-key-eval-ts-key-187a81/claude-code-claude-haiku-4-5-scanned-docker-eb062a/1/transcript.jsonl) | Claude Code · claude-haiku-4-5 | pass | 21k | 3s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 21k | 0 | 3.2s | not reported | not reported |

## key canary

`evals/key.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A6](#attempt-evals-key-eval-ts-key-canary-claude-code-claude-haiku-4-5-pl-a835233c) | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | not reported | expected [ '/proc/1/environ (raw)', …(4) ] to deeply equal [] |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected [ '/proc/1/environ (raw)', …(4) ] to deeply equal [] | n/a | n/a | 1 of 1 | [A6](#attempt-evals-key-eval-ts-key-canary-claude-code-claude-haiku-4-5-pl-a835233c) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## mcp

`evals/mcp.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A7](./evals-mcp-eval-ts-mcp-a42bcd/claude-code-claude-haiku-4-5-stamped-docker-7e166c/1/transcript.jsonl) | Claude Code · claude-haiku-4-5 | pass | 65k | 7s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 65k | 2 | 7.3s | not reported | not reported |

## mcp canary

`evals/mcp.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A8](#attempt-evals-mcp-eval-ts-mcp-canary-claude-code-claude-haiku-4-5-st-d0a1c32e) | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | not reported | expected '' to contain 'tools/call' |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected '' to contain 'tools/call' | n/a | n/a | 1 of 1 | [A8](#attempt-evals-mcp-eval-ts-mcp-canary-claude-code-claude-haiku-4-5-st-d0a1c32e) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## rules

`evals/rules.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A9](./evals-rules-eval-ts-rules-f3fd8d/claude-code-claude-haiku-4-5-ruled-docker-a010bf/1/transcript.jsonl) | Claude Code · claude-haiku-4-5 | pass | 44k | 6s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 44k | 0 | 6.1s | not reported | not reported |

## rules canary

`evals/rules.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A10](#attempt-evals-rules-eval-ts-rules-canary-claude-code-claude-haiku-4-707ef0ba) | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | not reported | expected null to be 'TANGERINE-41' // Object.is equality |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected null to be 'TANGERINE-41' // Object.is equality | n/a | n/a | 1 of 1 | [A10](#attempt-evals-rules-eval-ts-rules-canary-claude-code-claude-haiku-4-707ef0ba) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## skill

`evals/skill.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A11](./evals-skill-eval-ts-skill-468cc8/claude-code-claude-haiku-4-5-skilled-docker-7add5d/1/transcript.jsonl) | Claude Code · claude-haiku-4-5 | pass | 65k | 6s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 65k | 1 | 5.8s | not reported | not reported |

## skill canary

`evals/skill.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A12](#attempt-evals-skill-eval-ts-skill-canary-claude-code-claude-haiku-4-bc259512) | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | not reported | expected null to be 'PROBE-7F3K-QUILL' // Object.is equality |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected null to be 'PROBE-7F3K-QUILL' // Object.is equality | n/a | n/a | 1 of 1 | [A12](#attempt-evals-skill-eval-ts-skill-canary-claude-code-claude-haiku-4-bc259512) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## Tally

Evals: 6 fail · 6 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:claude-code-1.0.128-patch.5d1c985c · id 13db7c0f24b7 · no registry digest (built locally) · CLI 2.1.276 (Claude Code) |
| Harnesses | claude-code:claude-haiku-4-5 (model claude-haiku-4-5, served claude-haiku-4-5) |
| Environments | closed 62b9fdc93469; notes a9fe919c0f6d; planted 76aaffdb150e; ruled 3b6bc71a36c7; scanned 5c768772c7e8; skilled 31d96fe99677 · skills contract-probe; stamped a7c2720c31fc · mcp stamp |
| Judge | none by default · threshold 0.8 · version 0e2a4839495b |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.0 · @reeval/harness-opencode 0.2.0 · @reeval/harness-goose 0.1.0 · @reeval/harness-pi 0.1.0 · @reeval/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @reeval/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 24.21.0 · linux/x64 |
| Runner | local · runner |
| Artifacts | all |
| Context | 4 files |

> **Warning:** Image reeval-sandbox:claude-code-1.0.128-patch.5d1c985c isn't pushed, so an exact rerun needs this machine's image (id 13db7c0f24b7).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-edit-and-run-eval-ts-edit-and-run-claude-code-claude-h-f0dc1f2a"></a>A1 | edit and run | Claude Code · claude-haiku-4-5 | pass | 87k | 8s | 2 | 1 file (lines not recorded) | [transcript](./evals-edit-and-run-eval-ts-edit-and-run-db761a/claude-code-claude-haiku-4-5-notes-docker-13c892/1/transcript.jsonl), [diff](./evals-edit-and-run-eval-ts-edit-and-run-db761a/claude-code-claude-haiku-4-5-notes-docker-13c892/1/diff.patch) |
| <a id="attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-claude-code-c-3f0d7c3a"></a>A2 | edit and run canary | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-egress-eval-ts-egress-claude-code-claude-haiku-4-5-clo-91cd4f5a"></a>A3 | egress | Claude Code · claude-haiku-4-5 | pass | 44k | 8s | 1 | 1 file (lines not recorded) | [transcript](./evals-egress-eval-ts-egress-ae6df0/claude-code-claude-haiku-4-5-closed-docker-57fce2/1/transcript.jsonl), [diff](./evals-egress-eval-ts-egress-ae6df0/claude-code-claude-haiku-4-5-closed-docker-57fce2/1/diff.patch) |
| <a id="attempt-evals-egress-eval-ts-egress-canary-claude-code-claude-haiku-76ab9e2e"></a>A4 | egress canary | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-key-eval-ts-key-claude-code-claude-haiku-4-5-scanned-d-94a13220"></a>A5 | key | Claude Code · claude-haiku-4-5 | pass | 21k | 3s | 0 | not recorded | [transcript](./evals-key-eval-ts-key-187a81/claude-code-claude-haiku-4-5-scanned-docker-eb062a/1/transcript.jsonl), [diff](./evals-key-eval-ts-key-187a81/claude-code-claude-haiku-4-5-scanned-docker-eb062a/1/diff.patch) |
| <a id="attempt-evals-key-eval-ts-key-canary-claude-code-claude-haiku-4-5-pl-a835233c"></a>A6 | key canary | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-mcp-eval-ts-mcp-claude-code-claude-haiku-4-5-stamped-d-d63a0e81"></a>A7 | mcp | Claude Code · claude-haiku-4-5 | pass | 65k | 7s | 2 | not recorded | [transcript](./evals-mcp-eval-ts-mcp-a42bcd/claude-code-claude-haiku-4-5-stamped-docker-7e166c/1/transcript.jsonl), [diff](./evals-mcp-eval-ts-mcp-a42bcd/claude-code-claude-haiku-4-5-stamped-docker-7e166c/1/diff.patch) |
| <a id="attempt-evals-mcp-eval-ts-mcp-canary-claude-code-claude-haiku-4-5-st-d0a1c32e"></a>A8 | mcp canary | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-rules-eval-ts-rules-claude-code-claude-haiku-4-5-ruled-ee265c80"></a>A9 | rules | Claude Code · claude-haiku-4-5 | pass | 44k | 6s | 0 | 1 file (lines not recorded) | [transcript](./evals-rules-eval-ts-rules-f3fd8d/claude-code-claude-haiku-4-5-ruled-docker-a010bf/1/transcript.jsonl), [diff](./evals-rules-eval-ts-rules-f3fd8d/claude-code-claude-haiku-4-5-ruled-docker-a010bf/1/diff.patch) |
| <a id="attempt-evals-rules-eval-ts-rules-canary-claude-code-claude-haiku-4-707ef0ba"></a>A10 | rules canary | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-skill-claude-code-claude-haiku-4-5-skill-f87719c0"></a>A11 | skill | Claude Code · claude-haiku-4-5 | pass | 65k | 6s | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-skill-468cc8/claude-code-claude-haiku-4-5-skilled-docker-7add5d/1/transcript.jsonl), [diff](./evals-skill-eval-ts-skill-468cc8/claude-code-claude-haiku-4-5-skilled-docker-7add5d/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-skill-canary-claude-code-claude-haiku-4-bc259512"></a>A12 | skill canary | Claude Code · claude-haiku-4-5 | fail | not reported | 0ms | 0 | not recorded | n/a |
