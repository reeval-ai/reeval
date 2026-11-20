# Run 20260929T222130Z_fbc30c8_cursor-agent_33kp

3 of 5 counted attempts passed · 7 infra errors. 921ms wall time. Tokens: not reported. Cost: not reported. fbc30c8.

Run `20260929T222130Z_fbc30c8_cursor-agent_33kp` by cursor-agent, 2026-09-29, reeval 0.2.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/transcript.jsonl)
> - fails its check: 1 counted attempt reported no token usage; token medians omit them. [A3](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-70e87d/1/transcript.jsonl)
> - fails its judge: 1 counted attempt reported no token usage; token medians omit them. [A5](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-70e87d/1/transcript.jsonl)
> - house greeting › greets in the house style: 2 counted attempts reported no token usage; token medians omit them. [A7](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-fake-57f9db/1/transcript.jsonl), [A8](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl)
> - house greeting › writes a greeting: 2 counted attempts reported no token usage; token medians omit them. [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-fake-57f9db/1/transcript.jsonl), [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | fake-1[fast=true] | n/a | 7 attempts |
| broken | n/a | n/a | 7 attempts |

## writes greet.js

`evals/greet.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: infra error.

**100% passed**

1 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 7ms | not reported | n/a |
| [A2](#attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-1-ccbf816e) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A2](#attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-1-ccbf816e) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

### Judgments

| Judgment | Question | Threshold | Median |
| --- | --- | --- | --- |
| Does greet.js export greet | Does greet.js export greet? | diagnostic | 0.80 |

## fails its check

`evals/greet.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**0% passed**

0 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A3](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 7ms | not reported | expected command to succeed, exit code 1 |
| [A4](#attempt-evals-greet-eval-ts-fails-its-check-broken-fake-1-57cd9051) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected command to succeed, exit code 1 | n/a | n/a | 1 of 2, all on Fake | [A3](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-70e87d/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A4](#attempt-evals-greet-eval-ts-fails-its-check-broken-fake-1-57cd9051) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## fails its judge

`evals/greet.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**0% passed**

0 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 1ms | not reported | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) |
| [A6](#attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-1-7c3028d3) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) | n/a | n/a | 1 of 2, all on Fake | [A5](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-70e87d/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A6](#attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-1-7c3028d3) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

### Judgments

| Judgment | Question | Threshold | Median |
| --- | --- | --- | --- |
| Is greet.js perfect | Is greet.js perfect? | diagnostic | 0.80 |

## is skipped for now

`evals/greet.eval.ts`. Task. 2 coding harnesses, 0 attempts. Verdict: skipped.

## greets in Welsh

`evals/greet.eval.ts`. Task. 1 coding harness, 0 attempts. Verdict: todo.

## house greeting › greets in the house style

`evals/skill.eval.ts`. A/B. 2 coding harnesses, 2 arms, 4 attempts. Verdict: infra error.

**plain 0% vs with-house-greeting 100%: too few runs**

0 of 1 vs 1 of 1 attempt. Left out: 2 infra errors.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 1 | baseline | 1 infra error |
| with-house-greeting | 100% | 1 of 1 | too few runs | 1 infra error |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A7](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | fail | not reported | 7ms | not reported | expected command to succeed, exit code 1 |
| [A8](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 4ms | not reported | n/a |
| [A9](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-c6c11c3f) | broken | plain | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A10](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b1edcb03) | broken | with-house-greeting | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 2 of 4, all on broken | [A9](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-c6c11c3f), [A10](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b1edcb03) |
| error | expected command to succeed, exit code 1 | n/a | n/a | 1 of 4, all on plain, not gated | [A7](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-fake-57f9db/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-house-greeting | not reported | 1 | <0.1s | not reported | not reported |

## house greeting › writes a greeting

`evals/skill.eval.ts`. A/B. 2 coding harnesses, 2 arms, 4 attempts. Verdict: infra error.

**plain 100% vs with-house-greeting 100%: too few runs**

1 of 1 vs 1 of 1 attempt. Left out: 2 infra errors.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 100% | 1 of 1 | baseline | 1 infra error |
| with-house-greeting | 100% | 1 of 1 | too few runs | 1 infra error |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | pass | not reported | 10ms | not reported | n/a |
| [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 1ms | not reported | n/a |
| [A13](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-bdf42a84) | broken | plain | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A14](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-55631959) | broken | with-house-greeting | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 2 of 4, all on broken | [A13](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-bdf42a84), [A14](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-55631959) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | not reported | 1 | <0.1s | not reported | not reported |
| with-house-greeting | not reported | 1 | <0.1s | not reported | not reported |

### Questions

#### Pairwise: Which greeting reads more like our house style?

| A | B | A won | B won | Ties |
| --- | --- | --- | --- | --- |
| plain | with-house-greeting | 0 of 2 | 2 of 2 | 0 ties |

### Next

- Saturated: every arm hit 100% across all tasks. This comparison catches regressions; add harder tasks to separate variants.

## Tally

Evals: 2 fail · 3 infra errors · 1 skipped · 1 todo.

## State

| Field | Value |
| --- | --- |
| Executed at | fbc30c8833c5 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | broken, fake (served fake-1[fast=true]) |
| Environments | plain eca09e8f139f; with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version 5f5bd2b4c5f3 |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.0 · @reeval/harness-opencode 0.2.0 · @reeval/harness-goose 0.1.0 · @reeval/harness-pi 0.1.0 · @reeval/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @reeval/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.2.0 · node 22.14.0 · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Arm | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-fake-fake-1-78357184"></a>A1 | writes greet.js | Fake | n/a | pass | not reported | 7ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-1-ccbf816e"></a>A2 | writes greet.js | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-fake-fake-1-43c105b9"></a>A3 | fails its check | Fake | n/a | fail | not reported | 7ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-broken-fake-1-57cd9051"></a>A4 | fails its check | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-eval-ts-fails-its-judge-fake-fake-1-8e2d1a4a"></a>A5 | fails its judge | Fake | n/a | fail | not reported | 1ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-1-7c3028d3"></a>A6 | fails its judge | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-40544bdd"></a>A7 | house greeting › greets in the house style | Fake | plain | fail | not reported | 7ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-f0c40acd"></a>A8 | house greeting › greets in the house style | Fake | with-house-greeting | pass | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-fake-7a7667/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-c6c11c3f"></a>A9 | house greeting › greets in the house style | broken | plain | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b1edcb03"></a>A10 | house greeting › greets in the house style | broken | with-house-greeting | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-fb13554e"></a>A11 | house greeting › writes a greeting | Fake | plain | pass | not reported | 10ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-f27b167e"></a>A12 | house greeting › writes a greeting | Fake | with-house-greeting | pass | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-fake-7a7667/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-bdf42a84"></a>A13 | house greeting › writes a greeting | broken | plain | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-55631959"></a>A14 | house greeting › writes a greeting | broken | with-house-greeting | infra error | not reported | 0ms | 0 | not recorded | n/a |
