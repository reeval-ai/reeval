# works in a macOS VM

1 of 1 counted attempt passed. 968ms wall time. Tokens: not reported. Cost: not reported. 4cdd2eb.

Run `20261102T181719Z_4cdd2eb_cursor-agent_w3r7` by cursor-agent, 2026-11-02, reeval 0.18.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-vm-eval-ts-works-in-a-macos-vm-92d8e0/fake-tart-macos-sequoia-base-15-6-8c94ed/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 1 attempt |

`evals/vm.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-vm-eval-ts-works-in-a-macos-vm-92d8e0/fake-tart-macos-sequoia-base-15-6-8c94ed/1/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe hello | toBe | evals/vm.eval.ts:6 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | 4cdd2eb5df2a on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | none |
| Judge | none by default · threshold 0.8 · version 991ce2915785 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.13 · @reeval/harness-opencode 0.2.13 · @reeval/harness-goose 0.1.10 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.8 · @ai-sdk/harness-claude-code 1.0.171-patch.8cc1b324 · @reeval/harness-codex 0.1.10 · @reeval/harness-fx 0.1.5 · @reeval/harness-grok-build 0.1.8 · ai 7.0.156 · @ai-sdk/harness 1.0.167 · @ai-sdk/anthropic 4.0.91 · @ai-sdk/google 4.0.107 · @ai-sdk/openai 4.0.104 · @ai-sdk/typesafe-ai 3.0.29 |
| reeval | 0.18.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-vm-eval-ts-works-in-a-macos-vm-fake-tart-macos-sequoia-11eaeeb0"></a>A1 | works in a macOS VM | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./evals-vm-eval-ts-works-in-a-macos-vm-92d8e0/fake-tart-macos-sequoia-base-15-6-8c94ed/1/transcript.jsonl), [diff](./evals-vm-eval-ts-works-in-a-macos-vm-92d8e0/fake-tart-macos-sequoia-base-15-6-8c94ed/1/diff.patch) |
