# Run 20261027T093027Z_nogit_cursor-agent_sapx

5 of 9 counted attempts passed. 785ms wall time. Tokens: not reported. Cost: not reported.

Run `20261027T093027Z_nogit_cursor-agent_sapx` by cursor-agent, 2026-10-27, reeval 0.14.0, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - agrees: 2 counted attempts reported no token usage; token medians omit them. [A1](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/1/transcript.jsonl), [A2](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/2/transcript.jsonl)
> - splits: 3 counted attempts reported no token usage; token medians omit them. [A3](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/1/transcript.jsonl), [A4](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/2/transcript.jsonl), [A8](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/3/transcript.jsonl)
> - fails twice: 4 counted attempts reported no token usage; token medians omit them. [A5](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/1/transcript.jsonl), [A6](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/2/transcript.jsonl), [A7](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/3/transcript.jsonl), [A9](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/4/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 9 attempts |

## agrees

`bo.eval.ts`. Task. 1 coding harness, 2 attempts. Verdict: pass.

**100% passed**

2 of 2 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |
| [A2](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/2/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe 1 | toBe | n/a | 2 of 2 | 2 of 2 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## splits

`bo.eval.ts`. Task. 1 coding harness, 3 attempts. Verdict: pass.

**67% passed**

2 of 3 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A3](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |
| [A4](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/2/transcript.jsonl) | Fake | fail | not reported | 0ms | not reported | expected +0 to be 1 // Object.is equality |
| [A8](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/3/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe 1 | toBe | n/a | 2 of 3 | 2 of 3 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toBe 1 | expected +0 to be 1 // Object.is equality | n/a | 1 of 3 | [A4](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/2/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## fails twice

`bo.eval.ts`. Task. 1 coding harness, 4 attempts. Verdict: fail.

**25% passed**

1 of 4 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 0ms | not reported | expected +0 to be 1 // Object.is equality |
| [A6](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/2/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |
| [A7](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/3/transcript.jsonl) | Fake | fail | not reported | 0ms | not reported | expected +0 to be 1 // Object.is equality |
| [A9](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/4/transcript.jsonl) | Fake | fail | not reported | 0ms | not reported | expected +0 to be 1 // Object.is equality |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe 1 | toBe | n/a | 1 of 4 | 1 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toBe 1 | expected +0 to be 1 // Object.is equality | n/a | 3 of 4 | [A5](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/1/transcript.jsonl), [A7](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/3/transcript.jsonl), [A9](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/4/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## Tally

Evals: 1 fail · 2 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | none |
| Judge | none by default · threshold 0.8 · version 7390a72b715f |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.12 · @reeval/harness-opencode 0.2.10 · @reeval/harness-goose 0.1.6 · @reeval/harness-pi 0.2.8 · @reeval/harness-cursor-sdk 0.1.6 · @ai-sdk/harness-claude-code 1.0.160-patch.b17cde50 · @reeval/harness-codex 0.1.9 · @reeval/harness-fx 0.1.1 · @reeval/harness-grok-build 0.1.5 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/anthropic 4.0.83 · @ai-sdk/google 4.0.100 · @ai-sdk/openai 4.0.97 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.14.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-bo-eval-ts-agrees-fake-fake-1-6681b491"></a>A1 | agrees | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/1/transcript.jsonl), [diff](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-bo-eval-ts-agrees-fake-fake-2-794fcc04"></a>A2 | agrees | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/2/transcript.jsonl), [diff](./bo-eval-ts-agrees-39efc8/fake-fake-70e87d/2/diff.patch) |
| <a id="attempt-bo-eval-ts-splits-fake-fake-1-38049c04"></a>A3 | splits | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/1/transcript.jsonl), [diff](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-bo-eval-ts-splits-fake-fake-2-a74cee8f"></a>A4 | splits | Fake | fail | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/2/transcript.jsonl), [diff](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/2/diff.patch) |
| <a id="attempt-bo-eval-ts-fails-twice-fake-fake-1-3fa0c674"></a>A5 | fails twice | Fake | fail | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/1/transcript.jsonl), [diff](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-bo-eval-ts-fails-twice-fake-fake-2-85ac7e53"></a>A6 | fails twice | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/2/transcript.jsonl), [diff](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/2/diff.patch) |
| <a id="attempt-bo-eval-ts-fails-twice-fake-fake-3-1b8631b1"></a>A7 | fails twice | Fake | fail | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/3/transcript.jsonl), [diff](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/3/diff.patch) |
| <a id="attempt-bo-eval-ts-splits-fake-fake-3-014d7dd7"></a>A8 | splits | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/3/transcript.jsonl), [diff](./bo-eval-ts-splits-5310c2/fake-fake-70e87d/3/diff.patch) |
| <a id="attempt-bo-eval-ts-fails-twice-fake-fake-4-7e1a8546"></a>A9 | fails twice | Fake | fail | not reported | 0ms | 0 | not recorded | [transcript](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/4/transcript.jsonl), [diff](./bo-eval-ts-fails-twice-40f2c2/fake-fake-70e87d/4/diff.patch) |
