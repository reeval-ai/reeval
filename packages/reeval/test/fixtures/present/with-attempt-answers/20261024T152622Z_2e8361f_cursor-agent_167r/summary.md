# Run 20261024T152622Z_2e8361f_cursor-agent_167r

7 of 9 counted attempts passed · 13 infra errors. 11s wall time. Tokens: not reported. Cost: not reported. 2e8361f.

Run `20261024T152622Z_2e8361f_cursor-agent_167r` by cursor-agent, 2026-10-24, reeval 0.13.0, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - greets %s: Check "toSucceed grep -q Ahoy greet.js" never passes on the baseline and always passes on a variant on coding harness fake; it may not apply to the baseline.
> - greets %s: 4 counted attempts reported no token usage; token medians omit them. [A1](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl), [A2](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [A5](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl), [A6](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)
> - writes greet.js for Ada: 1 counted attempt reported no token usage; token medians omit them. [A9](./evals-cases-eval-ts-writes-greet-js-for-ada-4d85b3/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - writes greet.js for Grace: 1 counted attempt reported no token usage; token medians omit them. [A11](./evals-cases-eval-ts-writes-greet-js-for-grace-d92d65/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A13](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - fails its check: 1 counted attempt reported no token usage; token medians omit them. [A15](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - fails its judge: 1 counted attempt reported no token usage; token medians omit them. [A17](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - house greeting › greets in the house style: Check "house greeting" never passes on the baseline and always passes on a variant on coding harness fake; it may not apply to the baseline.
> - house greeting › greets in the house style: 2 counted attempts reported no token usage; token medians omit them. [A19](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl), [A20](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)
> - house greeting › writes a greeting: 2 counted attempts reported no token usage; token medians omit them. [A23](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), [A24](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | fake-1[fast=true] | n/a | 13 attempts |
| broken | n/a | n/a | 13 attempts |

## greets %s

`evals/cases.eval.ts`. A/B. 2 prompts, 2 coding harnesses, 2 arms, 8 attempts. Verdict: fail.

**plain 0% vs with-house-greeting 100%: too few runs, not by minLift 20**

0 of 2 vs 2 of 2 attempts. Left out: 4 infra errors.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 2 | baseline | 2 infra errors |
| with-house-greeting | 100% | 2 of 2 | too few runs, not by minLift 20 | 2 infra errors |

### By task

| Task | plain | with-house-greeting |
| --- | --- | --- |
| Ada | 0% (0 of 1) | 100% (1 of 1) |
| Grace | 0% (0 of 1) | 100% (1 of 1) |

### Attempts

| Attempt | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | Ada | fail | not reported | 231ms | not reported | expected command to succeed, exit code 1 |
| [A2](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | Ada | pass | not reported | 147ms | not reported | n/a |
| [A3](#attempt-evals-cases-eval-ts-greets-ada-broken-plain-docker-1-ed8cab6b) | broken | plain | Ada | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A4](#attempt-evals-cases-eval-ts-greets-ada-broken-with-house-greeting-do-42f93fa2) | broken | with-house-greeting | Ada | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A5](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | Grace | fail | not reported | 215ms | not reported | expected command to succeed, exit code 1 |
| [A6](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | Grace | pass | not reported | 133ms | not reported | n/a |
| [A7](#attempt-evals-cases-eval-ts-greets-grace-broken-plain-docker-1-d07f2bdb) | broken | plain | Grace | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A8](#attempt-evals-cases-eval-ts-greets-grace-broken-with-house-greeting-bc22ac7a) | broken | with-house-greeting | Grace | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | plain | with-house-greeting | Total |
| --- | --- | --- | --- | --- | --- |
| toSucceed grep -q Ahoy greet.js | toSucceed | n/a | 0 of 2 | 2 of 2 | 2 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 4 of 8, all on broken | [A3](#attempt-evals-cases-eval-ts-greets-ada-broken-plain-docker-1-ed8cab6b), [A4](#attempt-evals-cases-eval-ts-greets-ada-broken-with-house-greeting-do-42f93fa2), [A7](#attempt-evals-cases-eval-ts-greets-grace-broken-plain-docker-1-d07f2bdb), [A8](#attempt-evals-cases-eval-ts-greets-grace-broken-with-house-greeting-bc22ac7a) |
| failed check | toSucceed grep -q Ahoy greet.js | expected command to succeed, exit code 1 | n/a | 2 of 8, all on plain, not gated | [A1](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl), [A5](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

## writes greet.js for Ada

`evals/cases.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: infra error.

**100% passed**

1 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A9](./evals-cases-eval-ts-writes-greet-js-for-ada-4d85b3/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | pass | not reported | 2ms | not reported | n/a |
| [A10](#attempt-evals-cases-eval-ts-writes-greet-js-for-ada-broken-fake-fake-0459648e) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | n/a | 1 of 1 | n/a | 1 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A10](#attempt-evals-cases-eval-ts-writes-greet-js-for-ada-broken-fake-fake-0459648e) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## writes greet.js for Grace

`evals/cases.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: infra error.

**100% passed**

1 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A11](./evals-cases-eval-ts-writes-greet-js-for-grace-d92d65/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | pass | not reported | 2ms | not reported | n/a |
| [A12](#attempt-evals-cases-eval-ts-writes-greet-js-for-grace-broken-fake-fa-957b9afc) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | n/a | 1 of 1 | n/a | 1 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A12](#attempt-evals-cases-eval-ts-writes-greet-js-for-grace-broken-fake-fa-957b9afc) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## writes greet.js

`evals/greet.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: infra error.

**100% passed**

1 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A13](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | pass | not reported | 10ms | not reported | n/a |
| [A14](#attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-fake-1-59d945b5) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | n/a | 1 of 1 | n/a | 1 of 1 |
| toPass Does greet.js export greet? | toPass | n/a | 1 of 1 | n/a | 1 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A14](#attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-fake-1-59d945b5) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

### Judgments

| Judgment | Question | Threshold | Median | At or above |
| --- | --- | --- | --- | --- |
| Does greet.js export greet | Does greet.js export greet? | 0.80 | 0.80 | 1 of 1 |

Scores for Does greet.js export greet: [A13](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl) 0.80.

## fails its check

`evals/greet.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**0% passed**

0 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A15](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | fail | not reported | 11ms | not reported | expected command to succeed, exit code 1 |
| [A16](#attempt-evals-greet-eval-ts-fails-its-check-broken-fake-fake-1-c2224104) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toSucceed grep -q Bonjour greet.js | toSucceed | n/a | 0 of 1 | n/a | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toSucceed grep -q Bonjour greet.js | expected command to succeed, exit code 1 | n/a | 1 of 2, all on Fake | [A15](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A16](#attempt-evals-greet-eval-ts-fails-its-check-broken-fake-fake-1-c2224104) |

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
| [A17](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | fail | not reported | 6ms | not reported | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) |
| [A18](#attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-fake-1-a33a85c9) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | Fake | broken | Total |
| --- | --- | --- | --- | --- | --- |
| toPass Is greet.js perfect? | toPass | n/a | 0 of 1 | n/a | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toPass Is greet.js perfect? | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) | n/a | 1 of 2, all on Fake | [A17](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A18](#attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-fake-1-a33a85c9) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

### Judgments

| Judgment | Question | Threshold | Median | At or above |
| --- | --- | --- | --- | --- |
| Is greet.js perfect | Is greet.js perfect? | 0.95 | 0.80 | 0 of 1 |

Scores for Is greet.js perfect: [A17](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl) 0.80.

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
| [A19](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | fail | not reported | 243ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A20](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 96ms | not reported | n/a |
| [A21](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b0fe32ce) | broken | plain | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A22](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-36fa4b4e) | broken | with-house-greeting | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Checks

| Check | Matcher | At | plain | with-house-greeting | Total |
| --- | --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 1 of 1 | 1 of 1 | 2 of 2 |
| house greeting | toSucceed | n/a | 0 of 1 | 1 of 1 | 1 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 2 of 4, all on broken | [A21](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b0fe32ce), [A22](#attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-36fa4b4e) |
| failed check | house greeting | expected command to succeed, exit code 1 | n/a | 1 of 4, all on plain, not gated | [A19](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

### Questions

#### Choices: Does the greeting use the house style?

| Pick | Attempts |
| --- | --- |
| no | 1 of 2 |
| yes | 1 of 2 |

| Group | no | yes |
| --- | --- | --- |
| plain | 1 of 1 | 0 of 1 |
| with-house-greeting | 0 of 1 | 1 of 1 |

Passed by pick: no 0% (0 of 1), yes 100% (1 of 1).

#### Answers: How did the agent pick its greeting?

2 of 2 answered.

- It followed the prompt. ([A19](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl), Fake)
- It followed the prompt. ([A20](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), Fake)

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
| [A23](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | pass | not reported | 279ms | not reported | n/a |
| [A24](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 147ms | not reported | n/a |
| [A25](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-fc061cb4) | broken | plain | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A26](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-08bfd305) | broken | with-house-greeting | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 2 of 4, all on broken | [A25](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-fc061cb4), [A26](#attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-08bfd305) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | not reported | 1 | 0.3s | not reported | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

### Questions

#### Choices: Does the greeting use the house style?

| Pick | Attempts |
| --- | --- |
| no | 1 of 2 |
| yes | 1 of 2 |

| Group | no | yes |
| --- | --- | --- |
| plain | 1 of 1 | 0 of 1 |
| with-house-greeting | 0 of 1 | 1 of 1 |

Passed by pick: no 100% (1 of 1), yes 100% (1 of 1).

#### Pairwise: Which greeting reads more like our house style?

| Side | Won |
| --- | --- |
| plain | 0 of 2 |
| with-house-greeting | 2 of 2 |

0 ties.

#### Answers: How did the agent pick its greeting?

2 of 2 answered.

- It followed the prompt. ([A23](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), Fake)
- It followed the prompt. ([A24](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), Fake)

#### Not answered: Which greeting handles a missing name?

The model call failed: Rate limit exceeded (429).

### Next

- Saturated: every arm hit 100% across all tasks. This comparison catches regressions; add harder tasks to separate variants.

## Tally

Evals: 3 fail · 5 infra errors · 1 skipped · 1 todo.

## State

| Field | Value |
| --- | --- |
| Executed at | 2e8361f4f213 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.6 · id 652d6b750168 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | broken, fake (served fake-1[fast=true]) |
| Environments | fake eca09e8f139f; plain eca09e8f139f; with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version 26284eecb750 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.12 · @reeval/harness-opencode 0.2.10 · @reeval/harness-goose 0.1.5 · @reeval/harness-pi 0.2.8 · @reeval/harness-cursor-sdk 0.1.6 · @ai-sdk/harness-claude-code 1.0.160-patch.b17cde50 · @reeval/harness-codex 0.1.8 · @reeval/harness-fx 0.1.1 · @reeval/harness-grok-build 0.1.4 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/anthropic 4.0.83 · @ai-sdk/google 4.0.100 · @ai-sdk/openai 4.0.97 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.13.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Context | 1 file |

> **Warning:** Image reeval-sandbox:cursor-0.1.6 isn't pushed, so an exact rerun needs this machine's image (id 652d6b750168).

## Attempt index

| ID | Eval | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-cases-eval-ts-greets-ada-fake-plain-docker-1-15f86b7c"></a>A1 | greets %s | Fake | plain | Ada | fail | not reported | 231ms | 1 | 2 files (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-greets-ada-fake-with-house-greeting-dock-d14bccf4"></a>A2 | greets %s | Fake | with-house-greeting | Ada | pass | not reported | 147ms | 1 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-greets-ada-broken-plain-docker-1-ed8cab6b"></a>A3 | greets %s | broken | plain | Ada | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-cases-eval-ts-greets-ada-broken-with-house-greeting-do-42f93fa2"></a>A4 | greets %s | broken | with-house-greeting | Ada | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-cases-eval-ts-greets-grace-fake-plain-docker-1-4478cef0"></a>A5 | greets %s | Fake | plain | Grace | fail | not reported | 215ms | 1 | 2 files (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-greets-grace-fake-with-house-greeting-do-7de041c2"></a>A6 | greets %s | Fake | with-house-greeting | Grace | pass | not reported | 133ms | 1 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-greets-grace-broken-plain-docker-1-d07f2bdb"></a>A7 | greets %s | broken | plain | Grace | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-cases-eval-ts-greets-grace-broken-with-house-greeting-bc22ac7a"></a>A8 | greets %s | broken | with-house-greeting | Grace | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-cases-eval-ts-writes-greet-js-for-ada-fake-fake-fake-1-adb3ed94"></a>A9 | writes greet.js for Ada | Fake | n/a | n/a | pass | not reported | 2ms | 1 | 2 files (lines not recorded) | [transcript](./evals-cases-eval-ts-writes-greet-js-for-ada-4d85b3/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-writes-greet-js-for-ada-4d85b3/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-writes-greet-js-for-ada-broken-fake-fake-0459648e"></a>A10 | writes greet.js for Ada | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-cases-eval-ts-writes-greet-js-for-grace-fake-fake-fake-4dca5ce9"></a>A11 | writes greet.js for Grace | Fake | n/a | n/a | pass | not reported | 2ms | 1 | 2 files (lines not recorded) | [transcript](./evals-cases-eval-ts-writes-greet-js-for-grace-d92d65/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-writes-greet-js-for-grace-d92d65/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-writes-greet-js-for-grace-broken-fake-fa-957b9afc"></a>A12 | writes greet.js for Grace | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-fake-fake-fake-1-601c6d4b"></a>A13 | writes greet.js | Fake | n/a | n/a | pass | not reported | 10ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-broken-fake-fake-1-59d945b5"></a>A14 | writes greet.js | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-fake-fake-fake-1-87bf76a6"></a>A15 | fails its check | Fake | n/a | n/a | fail | not reported | 11ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-check-e6642c/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-broken-fake-fake-1-c2224104"></a>A16 | fails its check | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-eval-ts-fails-its-judge-fake-fake-fake-1-33de35e1"></a>A17 | fails its judge | Fake | n/a | n/a | fail | not reported | 6ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-judge-d8c87c/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-fails-its-judge-broken-fake-fake-1-a33a85c9"></a>A18 | fails its judge | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-27a8e8e8"></a>A19 | house greeting › greets in the house style | Fake | plain | n/a | fail | not reported | 243ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-plain-docker-98d88a/1/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-656d4c0b"></a>A20 | house greeting › greets in the house style | Fake | with-house-greeting | n/a | pass | not reported | 96ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-greets-in-the-house-style-81811f/fake-with-house-greeting-docker-a9116f/1/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-b0fe32ce"></a>A21 | house greeting › greets in the house style | broken | plain | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-greets-in-the-house-style-36fa4b4e"></a>A22 | house greeting › greets in the house style | broken | with-house-greeting | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-a824be0d"></a>A23 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 279ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-6ee93722"></a>A24 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 147ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-fc061cb4"></a>A25 | house greeting › writes a greeting | broken | plain | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-broken-08bfd305"></a>A26 | house greeting › writes a greeting | broken | with-house-greeting | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
