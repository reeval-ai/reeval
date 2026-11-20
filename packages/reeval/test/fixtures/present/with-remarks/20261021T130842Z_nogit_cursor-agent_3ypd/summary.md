# Run 20261021T130842Z_nogit_cursor-agent_3ypd

3 of 7 counted attempts passed. 9s wall time. Tokens: not reported. Cost: not reported.

Run `20261021T130842Z_nogit_cursor-agent_3ypd` by cursor-agent, 2026-10-21, reeval 0.11.0, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - coin: 3 counted attempts reported no token usage; token medians omit them. [A1](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/1/transcript.jsonl), [A3](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/2/transcript.jsonl), [A7](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/3/transcript.jsonl)
> - skill helps: Check "uses the marker" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - skill helps: 4 counted attempts reported no token usage; token medians omit them. [A2](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/1/transcript.jsonl), [A5](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/2/transcript.jsonl), [A4](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/1/transcript.jsonl), [A6](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/2/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 7 attempts |

## coin

`evals/coin.eval.ts`. Task. 1 coding harness, 3 attempts. Verdict: fail.

**33% passed**

1 of 3 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/1/transcript.jsonl) | Fake | pass | not reported | 4s | not reported | n/a |
| [A3](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/2/transcript.jsonl) | Fake | fail | not reported | 4s | not reported | lands heads: expected 2 to be 1 // Object.is equality |
| [A7](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/3/transcript.jsonl) | Fake | fail | not reported | 4s | not reported | lands heads: expected 3 to be 1 // Object.is equality |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| lands heads | toBe | n/a | 1 of 3 | 1 of 3 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | lands heads | expected 2 to be 1 // Object.is equality | n/a | 2 of 3 | [A3](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/2/transcript.jsonl), [A7](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/3/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 2 | 4.3s | not reported | not reported |

## skill helps

`evals/skill.eval.ts`. A/B. 1 coding harness, 2 arms, 4 attempts. Verdict: pass.

**docs 0% vs marked 100%: too few runs**

0 of 2 vs 2 of 2 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| docs | 0% | 0 of 2 | baseline | none |
| marked | 100% | 2 of 2 | too few runs | none |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A2](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/1/transcript.jsonl) | Fake | docs | fail | not reported | 4s | not reported | uses the marker: expected 'control' to be 'variant' // Object.is equality |
| [A4](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/1/transcript.jsonl) | Fake | marked | pass | not reported | 4s | not reported | n/a |
| [A5](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/2/transcript.jsonl) | Fake | docs | fail | not reported | 4s | not reported | uses the marker: expected 'control' to be 'variant' // Object.is equality |
| [A6](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/2/transcript.jsonl) | Fake | marked | pass | not reported | 4s | not reported | n/a |

### Checks

| Check | Matcher | At | docs | marked | Total |
| --- | --- | --- | --- | --- | --- |
| uses the marker | toBe | n/a | 0 of 2 | 2 of 2 | 2 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | uses the marker | expected 'control' to be 'variant' // Object.is equality | n/a | 2 of 4, all on docs, not gated | [A2](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/1/transcript.jsonl), [A5](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/2/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| docs | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| marked | not reported | 2 | 4.3s | not reported | not reported |

## Tally

Evals: 1 fail · 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | docs 6ceaca75e314 · mcp docs; marked 39308ac90d6b · mcp docs |
| Judge | none by default · threshold 0.8 · version 232cbb65edee |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.8 · @reeval/harness-opencode 0.2.8 · @reeval/harness-goose 0.1.3 · @reeval/harness-pi 0.2.7 · @reeval/harness-cursor-sdk 0.1.5 · @ai-sdk/harness-claude-code 1.0.160-patch.907f9184 · @reeval/harness-codex 0.1.7 · @reeval/harness-fx 0.1.0 · @reeval/harness-grok-build 0.1.0 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/google 4.0.100 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.11.0 · node 22.23.3 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Arm | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-coin-eval-ts-coin-fake-docs-fake-1-1bffedc2"></a>A1 | coin | Fake | n/a | pass | not reported | 4s | 2 | not recorded | [transcript](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/1/transcript.jsonl), [diff](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-skill-helps-fake-docs-fake-1-0bcea7be"></a>A2 | skill helps | Fake | docs | fail | not reported | 4s | 2 | not recorded | [transcript](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/1/transcript.jsonl), [diff](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/1/diff.patch) |
| <a id="attempt-evals-coin-eval-ts-coin-fake-docs-fake-2-ef2ded34"></a>A3 | coin | Fake | n/a | fail | not reported | 4s | 2 | not recorded | [transcript](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/2/transcript.jsonl), [diff](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/2/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-skill-helps-fake-marked-fake-1-293d7e5e"></a>A4 | skill helps | Fake | marked | pass | not reported | 4s | 2 | not recorded | [transcript](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/1/transcript.jsonl), [diff](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-skill-helps-fake-docs-fake-2-0315416e"></a>A5 | skill helps | Fake | docs | fail | not reported | 4s | 2 | not recorded | [transcript](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/2/transcript.jsonl), [diff](./evals-skill-eval-ts-skill-helps-0c70ce/fake-docs-fake-45ef0f/2/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-skill-helps-fake-marked-fake-2-18503376"></a>A6 | skill helps | Fake | marked | pass | not reported | 4s | 2 | not recorded | [transcript](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/2/transcript.jsonl), [diff](./evals-skill-eval-ts-skill-helps-0c70ce/fake-marked-fake-3cce79/2/diff.patch) |
| <a id="attempt-evals-coin-eval-ts-coin-fake-docs-fake-3-45ad5cb2"></a>A7 | coin | Fake | n/a | fail | not reported | 4s | 2 | not recorded | [transcript](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/3/transcript.jsonl), [diff](./evals-coin-eval-ts-coin-67040f/fake-docs-fake-45ef0f/3/diff.patch) |
