# Run 20261101T084238Z_4b17f3c_cursor-agent_0vbf

7 of 8 counted attempts passed · 1 infra error. 30s wall time. Tokens: not reported. Cost: not reported. 4b17f3c.

Run `20261101T084238Z_4b17f3c_cursor-agent_0vbf` by cursor-agent, 2026-11-01, reeval 0.17.2, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - greets %s: Check "toSucceed grep -q Ahoy greet.js" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - greets %s: 4 counted attempts reported no token usage; token medians omit them. [A1](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl), [A2](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [A3](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl), [A4](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A5](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - fails its check and its judge: 1 counted attempt reported no token usage; token medians omit them. [A6](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - house greeting › writes a greeting: 8 counted attempts reported no token usage; token medians omit them. [A8](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), [A10](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/transcript.jsonl), [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/transcript.jsonl), [A14](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/transcript.jsonl), [A9](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/transcript.jsonl), [A13](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/transcript.jsonl), [A15](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | fake-1[fast=true] | n/a | 14 attempts |
| broken | n/a | n/a | 1 attempt |

## greets %s

`evals/cases.eval.ts`. A/B. 2 prompts, 1 coding harness, 2 arms, 4 attempts. Verdict: fail.

**plain 0% vs with-house-greeting 100%: too few runs, not by minLift 20**

0 of 2 vs 2 of 2 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 2 | baseline | none |
| with-house-greeting | 100% | 2 of 2 | too few runs, not by minLift 20 | none |

### By task

| Task | plain | with-house-greeting |
| --- | --- | --- |
| Ada | 0% (0 of 1) | 100% (1 of 1) |
| Grace | 0% (0 of 1) | 100% (1 of 1) |

### Attempts

| Attempt | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | Ada | fail | not reported | 226ms | not reported | expected command to succeed, exit code 1 |
| [A2](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | Ada | pass | not reported | 141ms | not reported | n/a |
| [A3](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | Grace | fail | not reported | 240ms | not reported | expected command to succeed, exit code 1 |
| [A4](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | Grace | pass | not reported | 117ms | not reported | n/a |

### Checks

| Check | Matcher | At | plain | with-house-greeting | Total |
| --- | --- | --- | --- | --- | --- |
| toSucceed grep -q Ahoy greet.js | toSucceed | evals/cases.eval.ts:15 | 0 of 2 | 2 of 2 | 2 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toSucceed grep -q Ahoy greet.js | expected command to succeed, exit code 1 | evals/cases.eval.ts:15 | 2 of 4, all on plain, not gated | [A1](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl), [A3](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

## writes greet.js

`evals/greet.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | pass | not reported | 2ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | evals/greet.eval.ts:6 | 1 of 1 | 1 of 1 |
| toPass Does greet.js export greet? | toPass | evals/greet.eval.ts:7 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

### Judgments

| Judgment | Question | Threshold | Median | At or above |
| --- | --- | --- | --- | --- |
| Does greet.js export greet | Does greet.js export greet? | 0.80 | 0.80 | 1 of 1 |

## fails its check and its judge

`evals/greet.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A6](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | fail | not reported | 2ms | not reported | expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toSucceed grep -q Bonjour greet.js | toSucceed | evals/greet.eval.ts:13 | 0 of 1 | 0 of 1 |
| toPass Is greet.js perfect? | toPass | evals/greet.eval.ts:14 | 0 of 1 | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toSucceed grep -q Bonjour greet.js | expected command to succeed, exit code 1 | evals/greet.eval.ts:13 | 1 of 1 | [A6](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl) |
| failed check | toPass Is greet.js perfect? | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) | evals/greet.eval.ts:14 | 1 of 1 | [A6](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

### Judgments

| Judgment | Question | Threshold | Median | At or above |
| --- | --- | --- | --- | --- |
| Is greet.js perfect | Is greet.js perfect? | 0.95 | 0.80 | 0 of 1 |

## never starts

`evals/greet.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A7](#attempt-evals-greet-eval-ts-never-starts-broken-fake-fake-1-d9fe8f94) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 1 | [A7](#attempt-evals-greet-eval-ts-never-starts-broken-fake-fake-1-d9fe8f94) |

## is skipped for now

`evals/greet.eval.ts`. Task. 1 coding harness, 0 attempts. Verdict: skipped.

## greets in Welsh

`evals/greet.eval.ts`. Task. 1 coding harness, 0 attempts. Verdict: todo.

## house greeting › writes a greeting

`evals/skill.eval.ts`. A/B. 1 coding harness, 2 arms, 8 attempts. Verdict: pass.

**plain 100% vs with-house-greeting 100%: same**

4 of 4 vs 4 of 4 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 100% | 4 of 4 | baseline | none |
| with-house-greeting | 100% | 4 of 4 | same | none |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A8](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | pass | not reported | 224ms | not reported | n/a |
| [A9](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 100ms | not reported | n/a |
| [A10](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/transcript.jsonl) | Fake | plain | pass | not reported | 224ms | not reported | n/a |
| [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 129ms | not reported | n/a |
| [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/transcript.jsonl) | Fake | plain | pass | not reported | 232ms | not reported | n/a |
| [A13](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 106ms | not reported | n/a |
| [A14](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/transcript.jsonl) | Fake | plain | pass | not reported | 219ms | not reported | n/a |
| [A15](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 101ms | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | not reported | 1 | 0.2s | not reported | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

### Questions

#### Choices: Does the greeting use the house style?

| Pick | Attempts |
| --- | --- |
| no | 4 of 8 |
| yes | 4 of 8 |

#### Pairwise: Which greeting reads more like our house style?

| A | B | A won | B won | Ties |
| --- | --- | --- | --- | --- |
| plain | with-house-greeting | 0 of 8 | 8 of 8 | 0 ties |

#### Answers: How did the agent pick its greeting?

8 of 8 answered.

- It followed the prompt. ([A8](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), Fake)
- It followed the prompt. ([A10](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/transcript.jsonl), Fake)
- It followed the prompt. ([A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/transcript.jsonl), Fake)
- It followed the prompt. ([A14](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/transcript.jsonl), Fake)
- It followed the prompt. ([A9](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), Fake)
- It followed the prompt. ([A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/transcript.jsonl), Fake)
- It followed the prompt. ([A13](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/transcript.jsonl), Fake)
- It followed the prompt. ([A15](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/transcript.jsonl), Fake)

### Next

- Saturated: every arm hit 100% across all tasks. This comparison catches regressions; add harder tasks to separate variants.
- (observed) greeting on plain: hello 4
- (observed) greeting on with-house-greeting: ahoy 4
- (observed) lines on plain: 2 · 4 attempts
- (observed) lines on with-house-greeting: 2 · 4 attempts

## Tally

Evals: 2 fail · 2 pass · 1 infra error · 1 skipped · 1 todo.

## State

| Field | Value |
| --- | --- |
| Executed at | 4b17f3ceda0f on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.8 · id 4104d40d1946 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | broken, fake (served fake-1[fast=true]) |
| Environments | fake eca09e8f139f; plain eca09e8f139f; with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version f33c978c6027 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.13 · @reeval/harness-opencode 0.2.13 · @reeval/harness-goose 0.1.10 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.8 · @ai-sdk/harness-claude-code 1.0.171-patch.8cc1b324 · @reeval/harness-codex 0.1.10 · @reeval/harness-fx 0.1.5 · @reeval/harness-grok-build 0.1.8 · ai 7.0.156 · @ai-sdk/harness 1.0.167 · @ai-sdk/anthropic 4.0.91 · @ai-sdk/google 4.0.107 · @ai-sdk/openai 4.0.104 · @ai-sdk/typesafe-ai 3.0.29 |
| reeval | 0.17.2 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Context | 1 file |

> **Warning:** Image reeval-sandbox:cursor-0.1.8 isn't pushed, so an exact rerun needs this machine's image (id 4104d40d1946).

## Attempt index

| ID | Eval | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-cases-eval-ts-greets-ada-fake-plain-docker-1-15f86b7c"></a>A1 | greets %s | Fake | plain | Ada | fail | not reported | 226ms | 1 | 2 files (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-ada-8fa89b/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-greets-ada-fake-with-house-greeting-dock-d14bccf4"></a>A2 | greets %s | Fake | with-house-greeting | Ada | pass | not reported | 141ms | 1 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-ada-8fa89b/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-greets-grace-fake-plain-docker-1-4478cef0"></a>A3 | greets %s | Fake | plain | Grace | fail | not reported | 240ms | 1 | 2 files (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-grace-76447a/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-greets-grace-fake-with-house-greeting-do-7de041c2"></a>A4 | greets %s | Fake | with-house-greeting | Grace | pass | not reported | 117ms | 1 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-grace-76447a/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-fake-fake-fake-1-601c6d4b"></a>A5 | writes greet.js | Fake | n/a | n/a | pass | not reported | 2ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-and-its-judge-fake-fake-b3f77b75"></a>A6 | fails its check and its judge | Fake | n/a | n/a | fail | not reported | 2ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-greet-eval-ts-never-starts-broken-fake-fake-1-d9fe8f94"></a>A7 | never starts | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-a824be0d"></a>A8 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 224ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-6ee93722"></a>A9 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 100ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-3db5eb54"></a>A10 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 224ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-53dfffd4"></a>A11 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 129ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-495e1b9a"></a>A12 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 232ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-7259f15d"></a>A13 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 106ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-38ee5383"></a>A14 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 219ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/questions/4.json) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-07c11122"></a>A15 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 101ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/transcript.jsonl), [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/questions/4.json) |
