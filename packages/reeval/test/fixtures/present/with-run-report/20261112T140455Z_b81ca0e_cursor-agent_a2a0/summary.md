# Run 20261112T140455Z_b81ca0e_cursor-agent_a2a0

11 of 14 counted attempts passed · 1 infra error. 12s wall time. Tokens: not reported. Cost: not reported. b81ca0e.

Run `20261112T140455Z_b81ca0e_cursor-agent_a2a0` by cursor-agent, 2026-11-12, reeval 0.24.0, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - greets: Check "toSucceed grep -q Ahoy greet.js" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - greets: 4 counted attempts reported no token usage; token medians omit them. [A1](./evals-cases-eval-ts-greets-ada-f5df99/fake-plain-docker-98d88a/1/transcript.jsonl), [A2](./evals-cases-eval-ts-greets-ada-f5df99/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [A3](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-plain-docker-98d88a/1/transcript.jsonl), [A4](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A5](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/diff.patch)
> - fails its check and its judge: 1 counted attempt reported no token usage; token medians omit them. [A6](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - house greeting › writes a greeting: 8 counted attempts reported no token usage; token medians omit them. [A8](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/diff.patch), [A10](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/diff.patch), [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/diff.patch), [A14](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/diff.patch), [A9](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/diff.patch), [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/diff.patch), [A13](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/diff.patch), [A15](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/diff.patch)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | fake-1[fast=true] | n/a | 14 attempts |
| broken | n/a | n/a | 1 attempt |

## greets

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
| [A1](./evals-cases-eval-ts-greets-ada-f5df99/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | Ada | fail | not reported | 268ms | not reported | expected command to succeed, exit code 1 |
| [A2](./evals-cases-eval-ts-greets-ada-f5df99/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | Ada | pass | not reported | 132ms | not reported | n/a |
| [A3](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-plain-docker-98d88a/1/transcript.jsonl) | Fake | plain | Grace | fail | not reported | 256ms | not reported | expected command to succeed, exit code 1 |
| [A4](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl) | Fake | with-house-greeting | Grace | pass | not reported | 138ms | not reported | n/a |

### Checks

| Check | Matcher | At | plain | with-house-greeting | Total |
| --- | --- | --- | --- | --- | --- |
| toSucceed grep -q Ahoy greet.js | toSucceed | evals/cases.eval.ts:18 | 0 of 2 | 2 of 2 | 2 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toSucceed grep -q Ahoy greet.js | expected command to succeed, exit code 1 | evals/cases.eval.ts:18 | 2 of 4, all on plain, not gated | [A1](./evals-cases-eval-ts-greets-ada-f5df99/fake-plain-docker-98d88a/1/transcript.jsonl), [A3](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-plain-docker-98d88a/1/transcript.jsonl) |

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
| [A5](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/diff.patch) | Fake | pass | not reported | 14ms | not reported | n/a |

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
| [A6](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | fail | not reported | 18ms | not reported | expected command to succeed, exit code 1 |

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
| [A8](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/diff.patch) | Fake | plain | pass | not reported | 301ms | not reported | n/a |
| [A9](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/diff.patch) | Fake | with-house-greeting | pass | not reported | 145ms | not reported | n/a |
| [A10](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/diff.patch) | Fake | plain | pass | not reported | 285ms | not reported | n/a |
| [A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/diff.patch) | Fake | with-house-greeting | pass | not reported | 129ms | not reported | n/a |
| [A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/diff.patch) | Fake | plain | pass | not reported | 264ms | not reported | n/a |
| [A13](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/diff.patch) | Fake | with-house-greeting | pass | not reported | 110ms | not reported | n/a |
| [A14](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/diff.patch) | Fake | plain | pass | not reported | 280ms | not reported | n/a |
| [A15](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/diff.patch) | Fake | with-house-greeting | pass | not reported | 131ms | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | not reported | 1 | 0.3s | not reported | not reported |
| with-house-greeting | not reported | 1 | 0.1s | not reported | not reported |

### Questions

#### Choices: Does the greeting use the house style?

| Pick | Attempts |
| --- | --- |
| no | 4 of 8 |
| yes | 4 of 8 |

#### Pairwise: Which greeting reads more like our house style?

| Side | Won |
| --- | --- |
| plain | 0 of 8 |
| with-house-greeting | 8 of 8 |

0 ties.

#### Answers: How did the agent pick its greeting?

8 of 8 answered.

- It followed the prompt. ([A8](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/diff.patch), Fake)
- It followed the prompt. ([A10](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/diff.patch), Fake)
- It followed the prompt. ([A12](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/diff.patch), Fake)
- It followed the prompt. ([A14](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/diff.patch), Fake)
- It followed the prompt. ([A9](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/diff.patch), Fake)
- It followed the prompt. ([A11](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/diff.patch), Fake)
- It followed the prompt. ([A13](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/diff.patch), Fake)
- It followed the prompt. ([A15](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/diff.patch), Fake)

#### Not answered: Which greeting handles a missing name?

The model call failed: Rate limit exceeded (429).

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
| Executed at | b81ca0eb8641 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.9 · id b0744834a0d1 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | broken, fake (served fake-1[fast=true]) |
| Resources | docker 2 vCPU 4.0 GiB: 12 attempts · CPU 2.2 s (avg 0.23, peak 0.26 cores) · memory peak 19 MiB |
| Environments | fake eca09e8f139f; plain eca09e8f139f; with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version 2d647fa0daa8 |
| Packages | @vitest/expect 5.1.0 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.16 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.16 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.9 · @ai-sdk/harness-claude-code 1.0.176-patch.a9d56a8c · @reeval/harness-codex 0.1.13 · @reeval/harness-fx 0.1.11 · @reeval/harness-grok-build 0.1.12 · ai 7.0.161 · @ai-sdk/harness 1.0.172 · @ai-sdk/anthropic 4.0.95 · @ai-sdk/google 4.0.110 · @ai-sdk/openai 4.0.107 · @ai-sdk/typesafe-ai 3.0.32 |
| reeval | 0.24.0 · node 26.13.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | evidence |
| Context | 1 file |

> **Warning:** Image reeval-sandbox:cursor-0.1.9 isn't pushed, so an exact rerun needs this machine's image (id b0744834a0d1).

## Attempt index

| ID | Eval | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-cases-eval-ts-greets-ada-fake-plain-docker-1-e42b8e7f"></a>A1 | greets | Fake | plain | Ada | fail | not reported | 268ms | 1 | 2 files, +2 / -0 | [transcript](./evals-cases-eval-ts-greets-ada-f5df99/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-ada-f5df99/fake-plain-docker-98d88a/1/diff.patch), [snapshot](./evals-cases-eval-ts-greets-ada-f5df99/fake-plain-docker-98d88a/1/snapshots/final) |
| <a id="attempt-evals-cases-eval-ts-greets-ada-fake-with-house-greeting-dock-d571f074"></a>A2 | greets | Fake | with-house-greeting | Ada | pass | not reported | 132ms | 1 | 1 file, +1 / -0 | [transcript](./evals-cases-eval-ts-greets-ada-f5df99/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-ada-f5df99/fake-with-house-greeting-docker-a9116f/1/diff.patch), [snapshot](./evals-cases-eval-ts-greets-ada-f5df99/fake-with-house-greeting-docker-a9116f/1/snapshots/final) |
| <a id="attempt-evals-cases-eval-ts-greets-grace-fake-plain-docker-1-8cf04872"></a>A3 | greets | Fake | plain | Grace | fail | not reported | 256ms | 1 | 2 files, +2 / -0 | [transcript](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-plain-docker-98d88a/1/diff.patch), [snapshot](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-plain-docker-98d88a/1/snapshots/final) |
| <a id="attempt-evals-cases-eval-ts-greets-grace-fake-with-house-greeting-do-1a35d459"></a>A4 | greets | Fake | with-house-greeting | Grace | pass | not reported | 138ms | 1 | 1 file, +1 / -0 | [transcript](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-with-house-greeting-docker-a9116f/1/diff.patch), [snapshot](./evals-cases-eval-ts-greets-grace-a7b5e5/fake-with-house-greeting-docker-a9116f/1/snapshots/final) |
| <a id="attempt-evals-greet-eval-ts-writes-greet-js-fake-fake-fake-1-601c6d4b"></a>A5 | writes greet.js | Fake | n/a | n/a | pass | not reported | 14ms | 1 | 2 files, +2 / -0 | [diff](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/diff.patch), [snapshot](./evals-greet-eval-ts-writes-greet-js-df720a/fake-fake-fake-dc13e2/1/snapshots/final) |
| <a id="attempt-evals-greet-eval-ts-fails-its-check-and-its-judge-fake-fake-b3f77b75"></a>A6 | fails its check and its judge | Fake | n/a | n/a | fail | not reported | 18ms | 1 | 2 files, +2 / -0 | [transcript](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/diff.patch), [snapshot](./evals-greet-eval-ts-fails-its-check-and-its-judge-035df6/fake-fake-fake-dc13e2/1/snapshots/final) |
| <a id="attempt-evals-greet-eval-ts-never-starts-broken-fake-fake-1-d9fe8f94"></a>A7 | never starts | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | [snapshot](./evals-greet-eval-ts-never-starts-dd13ad/broken-fake-fake-ce01f3/1/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-a824be0d"></a>A8 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 301ms | 1 | 2 files, +2 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/1/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-6ee93722"></a>A9 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 145ms | 1 | 1 file, +1 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/1/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-3db5eb54"></a>A10 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 285ms | 1 | 2 files, +2 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/2/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-53dfffd4"></a>A11 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 129ms | 1 | 1 file, +1 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/2/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-495e1b9a"></a>A12 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 264ms | 1 | 2 files, +2 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/3/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-7259f15d"></a>A13 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 110ms | 1 | 1 file, +1 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/3/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-pl-38ee5383"></a>A14 | house greeting › writes a greeting | Fake | plain | n/a | pass | not reported | 280ms | 1 | 2 files, +2 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-plain-docker-98d88a/4/snapshots/final) |
| <a id="attempt-evals-skill-eval-ts-house-greeting-writes-a-greeting-fake-wi-07c11122"></a>A15 | house greeting › writes a greeting | Fake | with-house-greeting | n/a | pass | not reported | 131ms | 1 | 1 file, +1 / -0 | [diff](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/diff.patch), [q1](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/questions/3.json), [q2](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/questions/4.json), [snapshot](./evals-skill-eval-ts-house-greeting-writes-a-greeting-2c149c/fake-with-house-greeting-docker-a9116f/4/snapshots/final) |
