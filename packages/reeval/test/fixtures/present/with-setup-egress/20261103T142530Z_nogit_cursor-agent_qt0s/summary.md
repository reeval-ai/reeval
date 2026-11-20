# phased

1 of 1 counted attempt passed. 4s wall time. Tokens: not reported. Cost: not reported.

Run `20261103T142530Z_nogit_cursor-agent_qt0s` by cursor-agent, 2026-11-03, reeval 0.20.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-phased-eval-ts-phased-a1125a/fake-phased-docker-63a94c/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 1 attempt |

`evals/phased.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-phased-eval-ts-phased-a1125a/fake-phased-docker-63a94c/1/transcript.jsonl) | Fake | pass | not reported | 169ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe true | toBe | evals/phased.eval.ts:27 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 2 | 0.2s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.8 · id c169305ee210 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | fake |
| Environments | phased 983b8d02f25a |
| Judge | none by default · threshold 0.8 · version 4ad59c27538d |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.13 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.12 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.8 · @ai-sdk/harness-claude-code 1.0.176-patch.8c0f3055 · @reeval/harness-codex 0.1.10 · @reeval/harness-fx 0.1.7 · @reeval/harness-grok-build 0.1.10 · ai 7.0.161 · @ai-sdk/harness 1.0.172 · @ai-sdk/anthropic 4.0.95 · @ai-sdk/google 4.0.110 · @ai-sdk/openai 4.0.107 · @ai-sdk/typesafe-ai 3.0.32 |
| reeval | 0.20.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Image reeval-sandbox:cursor-0.1.8 isn't pushed, so an exact rerun needs this machine's image (id c169305ee210).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-phased-eval-ts-phased-fake-phased-docker-1-819ae943"></a>A1 | phased | Fake | pass | not reported | 169ms | 2 | not recorded | [transcript](./evals-phased-eval-ts-phased-a1125a/fake-phased-docker-63a94c/1/transcript.jsonl), [diff](./evals-phased-eval-ts-phased-a1125a/fake-phased-docker-63a94c/1/diff.patch) |
