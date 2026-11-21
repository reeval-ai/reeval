# Run 20260929T034441Z_nogit_runner_dvee

6 of 12 counted attempts passed. 43s wall time. Tokens: 174k. Cost: not reported.

Run `20260929T034441Z_nogit_runner_dvee` by runner, 2026-09-29, reeval 0.0.1, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - edit and run canary: 1 counted attempt reported no token usage; token medians omit them. [A2](#attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-codex-gpt-5-4-4305f4a0)
> - egress canary: 1 counted attempt reported no token usage; token medians omit them. [A4](#attempt-evals-egress-eval-ts-egress-canary-codex-gpt-5-4-mini-closed-b03946ee)
> - key canary: 1 counted attempt reported no token usage; token medians omit them. [A6](#attempt-evals-key-eval-ts-key-canary-codex-gpt-5-4-mini-planted-dock-f18034fe)
> - mcp canary: 1 counted attempt reported no token usage; token medians omit them. [A8](#attempt-evals-mcp-eval-ts-mcp-canary-codex-gpt-5-4-mini-stamped-dock-4db139a2)
> - rules canary: 1 counted attempt reported no token usage; token medians omit them. [A10](#attempt-evals-rules-eval-ts-rules-canary-codex-gpt-5-4-mini-ruled-do-f6f9f8ef)
> - skill canary: 1 counted attempt reported no token usage; token medians omit them. [A12](#attempt-evals-skill-eval-ts-skill-canary-codex-gpt-5-4-mini-skilled-53710083)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Codex · gpt-5.4-mini | n/a | n/a | 12 attempts |

## edit and run

`evals/edit-and-run.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-edit-and-run-eval-ts-edit-and-run-db761a/codex-gpt-5-4-mini-notes-docker-75bf81/1/transcript.jsonl) | Codex · gpt-5.4-mini | pass | 43k | 8s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 43k | 2 | 8.3s | not reported | not reported |

## edit and run canary

`evals/edit-and-run.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A2](#attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-codex-gpt-5-4-4305f4a0) | Codex · gpt-5.4-mini | fail | not reported | 0ms | not reported | expected 'status: draft' to be 'status: final' // Object.is equality |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected 'status: draft' to be 'status: final' // Object.is equality | n/a | n/a | 1 of 1 | [A2](#attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-codex-gpt-5-4-4305f4a0) |

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
| [A3](./evals-egress-eval-ts-egress-ae6df0/codex-gpt-5-4-mini-closed-docker-60dd41/1/transcript.jsonl) | Codex · gpt-5.4-mini | pass | 22k | 10s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 22k | 1 | 10s | not reported | not reported |

## egress canary

`evals/egress.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A4](#attempt-evals-egress-eval-ts-egress-canary-codex-gpt-5-4-mini-closed-b03946ee) | Codex · gpt-5.4-mini | fail | not reported | 0ms | not reported | expected '403 000' to match /^200 / |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected '403 000' to match /^200 / | n/a | n/a | 1 of 1 | [A4](#attempt-evals-egress-eval-ts-egress-canary-codex-gpt-5-4-mini-closed-b03946ee) |

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
| [A5](./evals-key-eval-ts-key-187a81/codex-gpt-5-4-mini-scanned-docker-19a58e/1/transcript.jsonl) | Codex · gpt-5.4-mini | pass | 10k | 4s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 10k | 0 | 4.4s | not reported | not reported |

## key canary

`evals/key.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A6](#attempt-evals-key-eval-ts-key-canary-codex-gpt-5-4-mini-planted-dock-f18034fe) | Codex · gpt-5.4-mini | fail | not reported | 0ms | not reported | expected [ '/proc/1/environ (raw)', …(3) ] to deeply equal [] |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected [ '/proc/1/environ (raw)', …(3) ] to deeply equal [] | n/a | n/a | 1 of 1 | [A6](#attempt-evals-key-eval-ts-key-canary-codex-gpt-5-4-mini-planted-dock-f18034fe) |

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
| [A7](./evals-mcp-eval-ts-mcp-a42bcd/codex-gpt-5-4-mini-stamped-docker-da5e7c/1/transcript.jsonl) | Codex · gpt-5.4-mini | pass | 33k | 5s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 33k | 1 | 5.2s | not reported | not reported |

## mcp canary

`evals/mcp.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A8](#attempt-evals-mcp-eval-ts-mcp-canary-codex-gpt-5-4-mini-stamped-dock-4db139a2) | Codex · gpt-5.4-mini | fail | not reported | 0ms | not reported | expected '' to contain 'tools/call' |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected '' to contain 'tools/call' | n/a | n/a | 1 of 1 | [A8](#attempt-evals-mcp-eval-ts-mcp-canary-codex-gpt-5-4-mini-stamped-dock-4db139a2) |

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
| [A9](./evals-rules-eval-ts-rules-f3fd8d/codex-gpt-5-4-mini-ruled-docker-6000df/1/transcript.jsonl) | Codex · gpt-5.4-mini | pass | 21k | 9s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 21k | 0 | 9.0s | not reported | not reported |

## rules canary

`evals/rules.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A10](#attempt-evals-rules-eval-ts-rules-canary-codex-gpt-5-4-mini-ruled-do-f6f9f8ef) | Codex · gpt-5.4-mini | fail | not reported | 0ms | not reported | expected null to be 'TANGERINE-41' // Object.is equality |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected null to be 'TANGERINE-41' // Object.is equality | n/a | n/a | 1 of 1 | [A10](#attempt-evals-rules-eval-ts-rules-canary-codex-gpt-5-4-mini-ruled-do-f6f9f8ef) |

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
| [A11](./evals-skill-eval-ts-skill-468cc8/codex-gpt-5-4-mini-skilled-docker-52ee27/1/transcript.jsonl) | Codex · gpt-5.4-mini | pass | 44k | 6s | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | 44k | 2 | 6.0s | not reported | not reported |

## skill canary

`evals/skill.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A12](#attempt-evals-skill-eval-ts-skill-canary-codex-gpt-5-4-mini-skilled-53710083) | Codex · gpt-5.4-mini | fail | not reported | 0ms | not reported | expected null to be 'PROBE-7F3K-QUILL' // Object.is equality |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected null to be 'PROBE-7F3K-QUILL' // Object.is equality | n/a | n/a | 1 of 1 | [A12](#attempt-evals-skill-eval-ts-skill-canary-codex-gpt-5-4-mini-skilled-53710083) |

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
| Images | reeval-sandbox:codex-0.1.0 · id 1b03c464ad8c · no registry digest (built locally) · CLI codex-cli 0.157.1 |
| Harnesses | codex:gpt-5.4-mini (model gpt-5.4-mini, served gpt-5.4-mini-2026-03-17[effort=medium]) |
| Environments | closed 62b9fdc93469; notes a9fe919c0f6d; planted 76aaffdb150e; ruled 3b6bc71a36c7; scanned 5c768772c7e8; skilled 31d96fe99677 · skills contract-probe; stamped a7c2720c31fc · mcp stamp |
| Judge | none by default · threshold 0.8 · version 0e2a4839495b |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.0 · @reeval/harness-opencode 0.2.0 · @reeval/harness-goose 0.1.0 · @reeval/harness-pi 0.1.0 · @reeval/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @reeval/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 24.21.0 · linux/x64 |
| Runner | local · runner |
| Artifacts | all |
| Context | 66 files |

> **Warning:** Image reeval-sandbox:codex-0.1.0 isn't pushed, so an exact rerun needs this machine's image (id 1b03c464ad8c).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-edit-and-run-eval-ts-edit-and-run-codex-gpt-5-4-mini-n-301a2e89"></a>A1 | edit and run | Codex · gpt-5.4-mini | pass | 43k | 8s | 2 | 1 file (lines not recorded) | [transcript](./evals-edit-and-run-eval-ts-edit-and-run-db761a/codex-gpt-5-4-mini-notes-docker-75bf81/1/transcript.jsonl), [diff](./evals-edit-and-run-eval-ts-edit-and-run-db761a/codex-gpt-5-4-mini-notes-docker-75bf81/1/diff.patch) |
| <a id="attempt-evals-edit-and-run-eval-ts-edit-and-run-canary-codex-gpt-5-4-4305f4a0"></a>A2 | edit and run canary | Codex · gpt-5.4-mini | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-egress-eval-ts-egress-codex-gpt-5-4-mini-closed-docker-6bd4fd45"></a>A3 | egress | Codex · gpt-5.4-mini | pass | 22k | 10s | 1 | 1 file (lines not recorded) | [transcript](./evals-egress-eval-ts-egress-ae6df0/codex-gpt-5-4-mini-closed-docker-60dd41/1/transcript.jsonl), [diff](./evals-egress-eval-ts-egress-ae6df0/codex-gpt-5-4-mini-closed-docker-60dd41/1/diff.patch) |
| <a id="attempt-evals-egress-eval-ts-egress-canary-codex-gpt-5-4-mini-closed-b03946ee"></a>A4 | egress canary | Codex · gpt-5.4-mini | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-key-eval-ts-key-codex-gpt-5-4-mini-scanned-docker-1-4a3d8e93"></a>A5 | key | Codex · gpt-5.4-mini | pass | 10k | 4s | 0 | not recorded | [transcript](./evals-key-eval-ts-key-187a81/codex-gpt-5-4-mini-scanned-docker-19a58e/1/transcript.jsonl), [diff](./evals-key-eval-ts-key-187a81/codex-gpt-5-4-mini-scanned-docker-19a58e/1/diff.patch) |
| <a id="attempt-evals-key-eval-ts-key-canary-codex-gpt-5-4-mini-planted-dock-f18034fe"></a>A6 | key canary | Codex · gpt-5.4-mini | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-mcp-eval-ts-mcp-codex-gpt-5-4-mini-stamped-docker-1-60c17252"></a>A7 | mcp | Codex · gpt-5.4-mini | pass | 33k | 5s | 1 | not recorded | [transcript](./evals-mcp-eval-ts-mcp-a42bcd/codex-gpt-5-4-mini-stamped-docker-da5e7c/1/transcript.jsonl), [diff](./evals-mcp-eval-ts-mcp-a42bcd/codex-gpt-5-4-mini-stamped-docker-da5e7c/1/diff.patch) |
| <a id="attempt-evals-mcp-eval-ts-mcp-canary-codex-gpt-5-4-mini-stamped-dock-4db139a2"></a>A8 | mcp canary | Codex · gpt-5.4-mini | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-rules-eval-ts-rules-codex-gpt-5-4-mini-ruled-docker-1-095bdebf"></a>A9 | rules | Codex · gpt-5.4-mini | pass | 21k | 9s | 0 | 1 file (lines not recorded) | [transcript](./evals-rules-eval-ts-rules-f3fd8d/codex-gpt-5-4-mini-ruled-docker-6000df/1/transcript.jsonl), [diff](./evals-rules-eval-ts-rules-f3fd8d/codex-gpt-5-4-mini-ruled-docker-6000df/1/diff.patch) |
| <a id="attempt-evals-rules-eval-ts-rules-canary-codex-gpt-5-4-mini-ruled-do-f6f9f8ef"></a>A10 | rules canary | Codex · gpt-5.4-mini | fail | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-skill-codex-gpt-5-4-mini-skilled-docker-8e4cff47"></a>A11 | skill | Codex · gpt-5.4-mini | pass | 44k | 6s | 2 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-skill-468cc8/codex-gpt-5-4-mini-skilled-docker-52ee27/1/transcript.jsonl), [diff](./evals-skill-eval-ts-skill-468cc8/codex-gpt-5-4-mini-skilled-docker-52ee27/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-skill-canary-codex-gpt-5-4-mini-skilled-53710083"></a>A12 | skill canary | Codex · gpt-5.4-mini | fail | not reported | 0ms | 0 | not recorded | n/a |
