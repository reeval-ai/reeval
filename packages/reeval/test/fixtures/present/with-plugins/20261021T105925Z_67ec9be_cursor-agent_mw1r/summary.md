# places the plugin

1 of 1 counted attempt passed. 756ms wall time. Tokens: not reported. Cost: not reported. 67ec9be (dirty).

Run `20261021T105925Z_67ec9be_cursor-agent_mw1r` by cursor-agent, 2026-10-21, reeval 0.11.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - The worktree was dirty; an exact rerun needs the saved worktree patch.
> - 1 counted attempt reported no token usage; token medians omit them. [A1](#attempt-evals-review-eval-ts-places-the-plugin-fake-review-fake-1-609e2d9c)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 1 attempt |

`evals/review.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](#attempt-evals-review-eval-ts-places-the-plugin-fake-review-fake-1-609e2d9c) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toContain Review | toContain | n/a | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | 67ec9be0279e on master, dirty (the commit that adds this record is later) |
| Uncommitted | worktree.patch, 209 bytes, sha256 036992c5a143 |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | review 84e3a3e69397 · skills review-lint |
| Judge | none by default · threshold 0.8 · version 232cbb65edee |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.8 · @reeval/harness-opencode 0.2.8 · @reeval/harness-goose 0.1.3 · @reeval/harness-pi 0.2.7 · @reeval/harness-cursor-sdk 0.1.5 · @ai-sdk/harness-claude-code 1.0.160-patch.907f9184 · @reeval/harness-codex 0.1.7 · @reeval/harness-fx 0.1.0 · @reeval/harness-grok-build 0.1.0 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/google 4.0.100 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.11.0 · node 22.23.3 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-review-eval-ts-places-the-plugin-fake-review-fake-1-609e2d9c"></a>A1 | places the plugin | Fake | pass | not reported | 0ms | 0 | not recorded | n/a |
