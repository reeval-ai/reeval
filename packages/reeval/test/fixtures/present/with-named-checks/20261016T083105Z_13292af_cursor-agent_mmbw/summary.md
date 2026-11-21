# Run 20261016T083105Z_13292af_cursor-agent_mmbw

3 of 5 counted attempts passed · 7 infra errors. 5s wall time. Tokens: not reported. Cost: not reported. 13292af.

Run `20261016T083105Z_13292af_cursor-agent_mmbw` by cursor-agent, 2026-10-16, reeval 0.8.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - fails its check: 1 counted attempt reported no token usage; token medians omit them. [A3](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - fails its judge: 1 counted attempt reported no token usage; token medians omit them. [A5](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - house greeting › greets in the house style: Check "house greeting" never passes on the baseline and always passes on a variant on coding harness fake; it may not apply to the baseline.
> - house greeting › greets in the house style: 2 counted attempts reported no token usage; token medians omit them. [A7](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl), [A8](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)
> - house greeting › writes a greeting: 2 counted attempts reported no token usage; token medians omit them. [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)

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
| [A1](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | pass | not reported | 6ms | not reported | n/a |
| [A2](#attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-fake-1-59d945b5) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | n/a | 1 of 1 | n/a | 1 of 1 |
| toPass Does greet.js export greet? | toPass | n/a | 1 of 1 | n/a | 1 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A2](#attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-fake-1-59d945b5) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

### Judgments

| Judgment | Question | Threshold | Median | At or above |
| --- | --- | --- | --- | --- |
| Does greet.js export greet | Does greet.js export greet? | 0.80 | 0.80 | 1 of 1 |

Scores for Does greet.js export greet: [A1](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl) 0.80.

## fails its check

`evals/greet.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**0% passed**

0 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A3](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | fail | not reported | 7ms | not reported | expected command to succeed, exit code 1 |
| [A4](#attempt-evals-greet-eval-ts-fails-its-check-broken-fake-fake-1-c2224104) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toSucceed grep -q Bonjour greet.js | toSucceed | n/a | 0 of 1 | n/a | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toSucceed grep -q Bonjour greet.js | expected command to succeed, exit code 1 | n/a | 1 of 2, all on Fake | [A3](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A4](#attempt-evals-greet-eval-ts-fails-its-check-broken-fake-fake-1-c2224104) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## fails its judge

`evals/greet.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**0% passed**

0 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | fail | not reported | 4ms | not reported | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) |
| [A6](#attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-fake-1-a33a85c9) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toPass Is greet.js perfect? | toPass | n/a | 0 of 1 | n/a | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toPass Is greet.js perfect? | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) | n/a | 1 of 2, all on Fake | [A5](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A6](#attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-fake-1-a33a85c9) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

### Judgments

| Judgment | Question | Threshold | Median | At or above |
| --- | --- | --- | --- | --- |
| Is greet.js perfect | Is greet.js perfect? | 0.95 | 0.80 | 0 of 1 |

Scores for Is greet.js perfect: [A5](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl) 0.80.

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
| [A7](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | fail | not reported | 187ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A8](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 99ms | not reported | n/a |
| [A9](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b0fe32ce) | broken | plain | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A10](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-36fa4b4e) | broken | with-house-greeting | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | plain | with-house-greeting | Total |
| --- | --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 1 of 1 | 1 of 1 | 2 of 2 |
| house greeting | toSucceed | n/a | 0 of 1 | 1 of 1 | 1 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 2 of 4, all on broken | [A9](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b0fe32ce), [A10](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-36fa4b4e) |
| failed check | house greeting | expected command to succeed, exit code 1 | n/a | 1 of 4, all on plain, not gated | [A7](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

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
| [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | pass | not reported | 211ms | not reported | n/a |
| [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 122ms | not reported | n/a |
| [A13](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-fc061cb4) | broken | plain | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A14](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-08bfd305) | broken | with-house-greeting | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 2 of 4, all on broken | [A13](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-fc061cb4), [A14](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-08bfd305) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | not reported | 1 | 0.2s | not reported | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

### Questions

#### Pairwise: Which greeting reads more like our house style?

| Side | Won |
| --- | --- |
| plain | 0 of 2 |
| with-house-greeting | 2 of 2 |

0 ties.

#### Not answered: Which greeting handles a missing name?

The model call failed: Rate limit exceeded (429).

### Next

- Saturated: every arm hit 100% across all tasks. This comparison catches regressions; add harder tasks to separate variants.

## Tally

Evals: 2 fail · 3 infra errors · 1 skipped · 1 todo.

## State

| Field | Value |
| --- | --- |
| Executed at | 13292af516d5 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.4 · id b381142592e9 · no registry digest (built locally) · CLI @cursor/sdk 1.0.37 |
| Harnesses | broken, fake (served fake-1[fast=true]) |
| Environments | fake eca09e8f139f; plain eca09e8f139f; with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version 77c8a1991e97 |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.6 · @reeval/harness-opencode 0.2.7 · @reeval/harness-goose 0.1.2 · @reeval/harness-pi 0.2.6 · @reeval/harness-cursor-sdk 0.1.4 · @ai-sdk/harness-claude-code 1.0.152-patch.8edc594f · @reeval/harness-codex 0.1.6 · ai 7.0.140 · @ai-sdk/harness 1.0.148 · @ai-sdk/google 4.0.93 · @ai-sdk/typesafe-ai 3.0.18 |
| reeval | 0.8.0 · node 22.14.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Context | 1 file |

> **Warning:** Image reeval-sandbox:cursor-0.1.4 isn't pushed, so an exact rerun needs this machine's image (id b381142592e9).

## Attempt index

| ID | Eval | Coding harness | Arm | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-fake-fake-fake-1-601c6d4b"></a>A1 | writes greet.js | Fake | n/a | pass | not reported | 6ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-fake-1-59d945b5"></a>A2 | writes greet.js | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-fake-fake-fake-1-87bf76a6"></a>A3 | fails its check | Fake | n/a | fail | not reported | 7ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-broken-fake-fake-1-c2224104"></a>A4 | fails its check | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-eval-ts-fails-its-judge-fake-fake-fake-1-33de35e1"></a>A5 | fails its judge | Fake | n/a | fail | not reported | 4ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-fake-1-a33a85c9"></a>A6 | fails its judge | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-27a8e8e8"></a>A7 | house greeting › greets in the house style | Fake | plain | fail | not reported | 187ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-656d4c0b"></a>A8 | house greeting › greets in the house style | Fake | with-house-greeting | pass | not reported | 99ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b0fe32ce"></a>A9 | house greeting › greets in the house style | broken | plain | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-36fa4b4e"></a>A10 | house greeting › greets in the house style | broken | with-house-greeting | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-a824be0d"></a>A11 | house greeting › writes a greeting | Fake | plain | pass | not reported | 211ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-6ee93722"></a>A12 | house greeting › writes a greeting | Fake | with-house-greeting | pass | not reported | 122ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-fc061cb4"></a>A13 | house greeting › writes a greeting | broken | plain | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-08bfd305"></a>A14 | house greeting › writes a greeting | broken | with-house-greeting | infra error | not reported | 0ms | 0 | not recorded | n/a |
