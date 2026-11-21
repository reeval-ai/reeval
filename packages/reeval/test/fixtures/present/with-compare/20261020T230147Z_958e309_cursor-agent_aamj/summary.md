# Run 20261020T230147Z_958e309_cursor-agent_aamj

5 of 8 counted attempts passed. 1s wall time. Tokens: not reported. Cost: not reported. 958e309.

Run `20261020T230147Z_958e309_cursor-agent_aamj` by cursor-agent, 2026-10-20, reeval 0.10.0, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - bills in minor units with the billing doc: 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-billing-eval-ts-bills-in-minor-units-with-the-billing-a15c29/fake-with-doc-fake-ff0b8e/1/transcript.jsonl)
> - adds a $name button that builds: 3 counted attempts reported no token usage; token medians omit them. [A2](./evals-buttons-eval-ts-adds-a-reset-button-that-builds-be7407/fake-fake-70e87d/1/transcript.jsonl), [A3](./evals-buttons-eval-ts-adds-a-double-button-that-builds-ff2bf6/fake-fake-70e87d/1/transcript.jsonl), [A4](./evals-buttons-eval-ts-adds-a-clear-button-that-builds-9c8b8b/fake-fake-70e87d/1/transcript.jsonl)
> - greets in the house style: 1 counted attempt reported no token usage; token medians omit them. [A5](./evals-greet-eval-ts-greets-in-the-house-style-bf5705/fake-fake-70e87d/1/transcript.jsonl)
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A6](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/transcript.jsonl)
> - greets in French: 1 counted attempt reported no token usage; token medians omit them. [A7](./evals-greet-eval-ts-greets-in-french-deb563/fake-fake-70e87d/1/transcript.jsonl)
> - greets in German: 1 counted attempt reported no token usage; token medians omit them. [A8](./evals-greet-eval-ts-greets-in-german-fd0f35/fake-fake-70e87d/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 8 attempts |

## bills in minor units with the billing doc

`evals/billing.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-billing-eval-ts-bills-in-minor-units-with-the-billing-a15c29/fake-with-doc-fake-ff0b8e/1/transcript.jsonl) | Fake | pass | not reported | 2ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| amount in minor units | toSucceed | n/a | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## adds a $name button that builds

`evals/buttons.eval.ts`. Task. 3 prompts, 1 coding harness, 3 attempts. Verdict: fail.

**67% passed**

2 of 3 attempts.

### By task

| Task | fake | total |
| --- | --- | --- |
| reset | 100% (1 of 1) | 100% (1 of 1) |
| double | 0% (0 of 1) | 0% (0 of 1) |
| clear | 100% (1 of 1) | 100% (1 of 1) |

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A2](./evals-buttons-eval-ts-adds-a-reset-button-that-builds-be7407/fake-fake-70e87d/1/transcript.jsonl) | Fake | reset | pass | not reported | 2ms | not reported | n/a |
| [A3](./evals-buttons-eval-ts-adds-a-double-button-that-builds-ff2bf6/fake-fake-70e87d/1/transcript.jsonl) | Fake | double | fail | not reported | 2ms | not reported | build: expected command to succeed, exit code 1 |
| [A4](./evals-buttons-eval-ts-adds-a-clear-button-that-builds-9c8b8b/fake-fake-70e87d/1/transcript.jsonl) | Fake | clear | pass | not reported | 5ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| build | toSucceed | n/a | 2 of 3 | 2 of 3 |
| types | toSucceed | n/a | 2 of 2 | 2 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | build | expected command to succeed, exit code 1 | n/a | 1 of 3 | [A3](./evals-buttons-eval-ts-adds-a-double-button-that-builds-ff2bf6/fake-fake-70e87d/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## greets in the house style

`evals/greet.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./evals-greet-eval-ts-greets-in-the-house-style-bf5705/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 1ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 1 of 1 | 1 of 1 |
| house greeting | toSucceed | n/a | 1 of 1 | 1 of 1 |
| sign-off | toSucceed | n/a | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## writes greet.js

`evals/greet.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A6](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 6ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## greets in French

`evals/greet.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A7](./evals-greet-eval-ts-greets-in-french-deb563/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 5ms | not reported | french greeting: expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| french greeting | toSucceed | n/a | 0 of 1 | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | french greeting | expected command to succeed, exit code 1 | n/a | 1 of 1 | [A7](./evals-greet-eval-ts-greets-in-french-deb563/fake-fake-70e87d/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## greets in German

`evals/greet.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A8](./evals-greet-eval-ts-greets-in-german-fd0f35/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 5ms | not reported | german greeting: expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| german greeting | toSucceed | n/a | 0 of 1 | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | german greeting | expected command to succeed, exit code 1 | n/a | 1 of 1 | [A8](./evals-greet-eval-ts-greets-in-german-fd0f35/fake-fake-70e87d/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## Tally

Evals: 3 fail · 3 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | 958e309150a2 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | with-doc 007345e67fac |
| Judge | none by default · threshold 0.8 · version 5ca76dcaadfa |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.8 · @reeval/harness-opencode 0.2.8 · @reeval/harness-goose 0.1.3 · @reeval/harness-pi 0.2.7 · @reeval/harness-cursor-sdk 0.1.5 · @ai-sdk/harness-claude-code 1.0.158-patch.6c1cff12 · @reeval/harness-codex 0.1.7 · @reeval/harness-fx 0.1.0 · @reeval/harness-grok-build 0.1.0 · ai 7.0.143 · @ai-sdk/harness 1.0.154 · @ai-sdk/google 4.0.99 · @ai-sdk/typesafe-ai 3.0.21 |
| reeval | 0.10.0 · node 22.23.3 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Case | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-billing-eval-ts-bills-in-minor-units-with-the-billing-8b2391c8"></a>A1 | bills in minor units with the billing doc | Fake | n/a | pass | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-billing-eval-ts-bills-in-minor-units-with-the-billing-a15c29/fake-with-doc-fake-ff0b8e/1/transcript.jsonl), [diff](./evals-billing-eval-ts-bills-in-minor-units-with-the-billing-a15c29/fake-with-doc-fake-ff0b8e/1/diff.patch) |
| <a id="attempt-evals-buttons-eval-ts-adds-a-reset-button-that-builds-fake-f-cd2d06a4"></a>A2 | adds a $name button that builds | Fake | reset | pass | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-buttons-eval-ts-adds-a-reset-button-that-builds-be7407/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-buttons-eval-ts-adds-a-reset-button-that-builds-be7407/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-buttons-eval-ts-adds-a-double-button-that-builds-fake-6019f087"></a>A3 | adds a $name button that builds | Fake | double | fail | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-buttons-eval-ts-adds-a-double-button-that-builds-ff2bf6/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-buttons-eval-ts-adds-a-double-button-that-builds-ff2bf6/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-buttons-eval-ts-adds-a-clear-button-that-builds-fake-f-fb923b9b"></a>A4 | adds a $name button that builds | Fake | clear | pass | not reported | 5ms | 0 | 1 file (lines not recorded) | [transcript](./evals-buttons-eval-ts-adds-a-clear-button-that-builds-9c8b8b/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-buttons-eval-ts-adds-a-clear-button-that-builds-9c8b8b/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-greets-in-the-house-style-fake-fake-1-0b208ce4"></a>A5 | greets in the house style | Fake | n/a | pass | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-greet-eval-ts-greets-in-the-house-style-bf5705/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-eval-ts-greets-in-the-house-style-bf5705/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-fake-fake-1-78357184"></a>A6 | writes greet.js | Fake | n/a | pass | not reported | 6ms | 0 | 1 file (lines not recorded) | [transcript](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-greets-in-french-fake-fake-1-ef2cd30c"></a>A7 | greets in French | Fake | n/a | fail | not reported | 5ms | 0 | 1 file (lines not recorded) | [transcript](./evals-greet-eval-ts-greets-in-french-deb563/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-eval-ts-greets-in-french-deb563/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-greets-in-german-fake-fake-1-e9e32e78"></a>A8 | greets in German | Fake | n/a | fail | not reported | 5ms | 0 | 1 file (lines not recorded) | [transcript](./evals-greet-eval-ts-greets-in-german-fd0f35/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-eval-ts-greets-in-german-fd0f35/fake-fake-70e87d/1/diff.patch) |
