# Run 20261125T232927Z_00a0f94_cursor-agent_hk11

7 of 8 counted attempts passed, 1 infra errors. 17s wall time. No USD cost recorded. 00a0f94.

Run `20261125T232927Z_00a0f94_cursor-agent_hk11` by cursor-agent, 2026-11-25, reeval 0.31.0, varying runs per cell.

> [!WARNING]
> Integrity: read these before the results.
>
> - Check "toSucceed grep -q Ahoy greet.js" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - 4 counted attempts reported no token usage; token medians omit them. [A1](./cases-ada-756e9f/fake-plain-docker-98d88a/1/transcript.jsonl), [A2](./cases-ada-756e9f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [A3](./cases-grace-113891/fake-plain-docker-98d88a/1/transcript.jsonl), [A4](./cases-grace-113891/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl)
> - 1 counted attempt reported no token usage; token medians omit them. [A5](./fails-its-check-and-its-judge-19bdf6/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - 8 counted attempts reported no token usage; token medians omit them. [A7](./skill-9c53c0/fake-plain-docker-98d88a/1/diff.patch), [A9](./skill-9c53c0/fake-plain-docker-98d88a/2/diff.patch), [A12](./skill-9c53c0/fake-plain-docker-98d88a/3/diff.patch), [A14](./skill-9c53c0/fake-plain-docker-98d88a/4/diff.patch), [A8](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/1/diff.patch), [A10](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/2/diff.patch), [A13](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/3/diff.patch), [A15](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/4/diff.patch)
> - 1 counted attempt reported no token usage; token medians omit them. [A11](./writes-greet-js-b165c7/fake-fake-fake-dc13e2/1/diff.patch)

## Summary

The house-style skill lifts the pass rate.

| Evaluation | Shape / arms | Primary result | Effort |
| --- | --- | --- | --- |
| [cases](#cases) | ab; 2 prompts, 1 coding harness, 2 arms, 4 attempts | with-house-greeting vs plain: +100 pts pass rate (100% vs 0%) | not reported |
| [fails-its-check-and-its-judge](#fails-its-check-and-its-judge) | task; 1 coding harness, 1 attempt | 0% passed | not reported |
| [greets-in-welsh](#greets-in-welsh) | task; 1 coding harness, 0 attempts | Median tokens: not reported | not reported |
| [is-skipped-for-now](#is-skipped-for-now) | task; 1 coding harness, 0 attempts | Median tokens: not reported | not reported |
| [never-starts](#never-starts) | task; 1 coding harness, 1 attempt | Median tokens: not reported | not reported |
| [skill](#skill) | ab; 1 coding harness, 2 arms, 8 attempts | with-house-greeting vs plain: tied at 100% pass rate, median agent time -59% (0.1s vs 0.3s) | not reported |
| [writes-greet-js](#writes-greet-js) | task; 1 coding harness, 1 attempt | 100% passed | not reported |

### Key findings across evaluations

- Every eval ran once.
- The variant passed where the control failed.

## Coding harnesses

| Coding harness | Model | Effort | Served models | Gateway | Attempts |
| --- | --- | --- | --- | --- | --- |
| broken | n/a | n/a | n/a | n/a | 1 |
| fake | n/a | n/a | fake-1[fast=true] | n/a | 14 |

## cases

`evals/cases.eval.ts`. A/B. 2 prompts, 1 coding harness, 2 arms, 4 attempts.

with-house-greeting against the plain baseline

**with-house-greeting vs plain: +100 pts pass rate (100% vs 0%)**

n = 2 vs 2 counted attempts. 95% CI +7 pts to +100 pts. 2 per side is below 4, so this cannot come back helped or made worse.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

### Baseline vs. variants

- **plain** (`sha256:eca09e8f139fb2456ce711a4f177ce81d9a5fdef6f8cdc80e9746ba8c5a9aae9`): baseline
- **with-house-greeting** (`sha256:7b5dd0e29b0dce7a2b796abca66e941ba97b932c7ddbf22e4efc09f381b2a5f7`): variant: with-house-greeting

| Arm | Pass rate | Lift | Pass-rate verdict | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plain | 0% | n/a | Baseline | not reported | 1 | 1 | not reported | 0.2s | 2 | 2 | 0 |
| with-house-greeting | 100% | +100 pts | Too few runs | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.1s (-53%) | 1 (-50%) | 1 (-50%) | 0 |

### Assertions by arm

| Assertion | Matcher | plain | with-house-greeting | Total |
| --- | --- | --- | --- | --- |
| toSucceed grep -q Ahoy greet.js | toSucceed | 0 of 2 | 2 of 2 | 2 of 4 |

### Effort by coding harness

| Coding harness | Arm | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fake | plain | 0% | not reported | 1 | 1 | not reported | 0.2s | 2 | 2 | 0 |
| fake | with-house-greeting | 100% | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.1s (-53%) | 1 (-50%) | 1 (-50%) | 0 |

### Failures and caveats

| Kind | Label | At | Count | Attempts |
| --- | --- | --- | --- | --- |
| assertion | toSucceed grep -q Ahoy greet.js | evals/cases.eval.ts:15 | 2 of 4 | [A1](./cases-ada-756e9f/fake-plain-docker-98d88a/1/transcript.jsonl), [A3](./cases-grace-113891/fake-plain-docker-98d88a/1/transcript.jsonl) |
| error | expected command to succeed, exit code 1 | n/a | 2 of 4 | [A1](./cases-ada-756e9f/fake-plain-docker-98d88a/1/transcript.jsonl), [A3](./cases-grace-113891/fake-plain-docker-98d88a/1/transcript.jsonl) |

#### Worth knowing

- (concern) The with-house-greeting variant, paired over 2 cases: better, but a paired lift needs 6 cases that differ between the arms to hold. It runs 2.1× faster, but 2 cases can't confirm it; 5 is the least that can. Fix at evals/cases.eval.ts: add cases, so 6 or more can differ between the arms.

## fails-its-check-and-its-judge

`evals/fails-its-check-and-its-judge.eval.ts`. Task. 1 coding harness, 1 attempt.

**0% passed**

0 of 1 counted attempts passed on all 2 assertions. 1 coding harness.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

### Assertions

| Assertion | Matcher | fake | Total |
| --- | --- | --- | --- |
| toSucceed grep -q Bonjour greet.js | toSucceed | 0 of 1 | 0 of 1 |
| toPass Is greet.js perfect? | toPass | 0 of 1 | 0 of 1 |

### By Coding harness

| Coding harness | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fake | 0% | not reported | 1 | 1 | not reported | <0.1s | 2 | 2 | 0 |

### Judgments

| Label | Question | Threshold | Keys | Median | At or above |
| --- | --- | --- | --- | --- | --- |
| Is greet.js perfect | Is greet.js perfect? | 0.95 | Coding harness / Arm | 0.80 | 0 of 1 |

### Failures and caveats

| Kind | Label | At | Count | Attempts |
| --- | --- | --- | --- | --- |
| assertion | toSucceed grep -q Bonjour greet.js | evals/fails-its-check-and-its-judge.eval.ts:8 | 1 of 1 | [A5](./fails-its-check-and-its-judge-19bdf6/fake-fake-fake-dc13e2/1/transcript.jsonl) |
| assertion | toPass Is greet.js perfect? | evals/fails-its-check-and-its-judge.eval.ts:9 | 1 of 1 | [A5](./fails-its-check-and-its-judge-19bdf6/fake-fake-fake-dc13e2/1/transcript.jsonl) |
| error | expected command to succeed, exit code 1 | n/a | 1 of 1 | [A5](./fails-its-check-and-its-judge-19bdf6/fake-fake-fake-dc13e2/1/transcript.jsonl) |

## greets-in-welsh

`evals/greets-in-welsh.eval.ts`. Task. 1 coding harness, 0 attempts.

**Median tokens: not reported**

No attempt reported usage.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

## is-skipped-for-now

`evals/is-skipped-for-now.eval.ts`. Task. 1 coding harness, 0 attempts.

**Median tokens: not reported**

No attempt reported usage.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

## never-starts

`evals/never-starts.eval.ts`. Task. 1 coding harness, 1 attempt.

**Median tokens: not reported**

No attempt reported usage.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

### Failures and caveats

| Kind | Label | At | Count | Attempts |
| --- | --- | --- | --- | --- |
| infra-error | the fake sandbox fell over | n/a | 1 of 1 | [A6](#attempt-never-starts-broken-fake-fake-1-f473d78e) |

## skill

`evals/skill.eval.ts`. A/B. 1 coding harness, 2 arms, 8 attempts.

with-house-greeting against the plain baseline

**with-house-greeting vs plain: tied at 100% pass rate, median agent time -59% (0.1s vs 0.3s)**

Every attempt passed all 2 applicable assertions (8 of 8).

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

### Baseline vs. variants

- **plain** (`sha256:eca09e8f139fb2456ce711a4f177ce81d9a5fdef6f8cdc80e9746ba8c5a9aae9`): baseline
- **with-house-greeting** (`sha256:7b5dd0e29b0dce7a2b796abca66e941ba97b932c7ddbf22e4efc09f381b2a5f7`): variant: with-house-greeting

Every arm passed every applicable assertion (2 checks).

| Arm | Pass rate | Lift | Pass-rate verdict | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plain | 100% | n/a | Baseline | not reported | 1 | 1 | not reported | 0.3s | 2 | 2 | 0 |
| with-house-greeting | 100% | ±0 pts | Within noise | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.1s (-59%) | 1 (-50%) | 1 (-50%) | 0 |

### Effort by coding harness

| Coding harness | Arm | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fake | plain | 100% | not reported | 1 | 1 | not reported | 0.3s | 2 | 2 | 0 |
| fake | with-house-greeting | 100% | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.1s (-59%) | 1 (-50%) | 1 (-50%) | 0 |

### Choices: Does the greeting use the house style?

no 4, yes 4

| Arm | Prompt | Coding harness | no | yes | Attempts |
| --- | --- | --- | --- | --- | --- |
| plain | n/a | fake | 4 | 0 | 4 |
| with-house-greeting | n/a | fake | 0 | 4 | 4 |

#### Pass rate by pick

| Pick | Pass rate | n |
| --- | --- | --- |
| no | 100% | 4 |
| yes | 100% | 4 |

### Pairwise review

| Question | Cut | A | B | A wins | B wins | Ties | Pairs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Which greeting reads more like our house style? | within | plain | with-house-greeting | 0 | 8 | 0 | 8 |

### Answers: How did the agent pick its greeting?

8 of 8 answered.

- It followed the prompt. ([A7, fake](./skill-9c53c0/fake-plain-docker-98d88a/1/diff.patch))
- It followed the prompt. ([A9, fake](./skill-9c53c0/fake-plain-docker-98d88a/2/diff.patch))
- It followed the prompt. ([A12, fake](./skill-9c53c0/fake-plain-docker-98d88a/3/diff.patch))
- It followed the prompt. ([A14, fake](./skill-9c53c0/fake-plain-docker-98d88a/4/diff.patch))
- It followed the prompt. ([A8, fake](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/1/diff.patch))
- It followed the prompt. ([A10, fake](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/2/diff.patch))
- It followed the prompt. ([A13, fake](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/3/diff.patch))
- It followed the prompt. ([A15, fake](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/4/diff.patch))

## writes-greet-js

`evals/writes-greet-js.eval.ts`. Task. 1 coding harness, 1 attempt.

**100% passed**

1 of 1 counted attempts passed on all 2 assertions. 1 coding harness.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

### Assertions

| Assertion | Matcher | fake | Total |
| --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | 1 of 1 | 1 of 1 |
| toPass Does greet.js export greet? | toPass | 1 of 1 | 1 of 1 |

### By Coding harness

| Coding harness | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fake | 100% | not reported | 1 | 1 | not reported | <0.1s | 2 | 2 | 0 |

### Judgments

| Label | Question | Threshold | Keys | Median | At or above |
| --- | --- | --- | --- | --- | --- |
| Does greet.js export greet | Does greet.js export greet? | 0.8 | Coding harness / Arm | 0.80 | 1 of 1 |

## Recommended actions

- Rerun the compare

## State

| Field | Value |
| --- | --- |
| Executed at | 00a0f94ec222 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.9 · id fba6d57ff99e · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Agents | broken, fake (served fake-1[fast=true]) |
| Resources | docker 2 vCPU 4.0 GiB: 12 attempts · CPU 2.1 s (avg 0.24, peak 0.28 cores) · memory peak 21 MiB |
| Environments | fake eca09e8f139f; plain eca09e8f139f; with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version 0899605ae6f9 |
| Packages | @vitest/expect 5.1.0 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.17 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.17 · @reeval/harness-pi 0.2.10 · @reeval/harness-cursor-sdk 0.1.9 … |
| reeval | 0.31.0 · node 26.13.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | evidence |
| Record | [20261125T232927Z_00a0f94_cursor-agent_hk11.json](../20261125T232927Z_00a0f94_cursor-agent_hk11.json) |
| Context | 1 files |

| Path | sha256 |
| --- | --- |
| ~/.agents/skills/house-greeting/SKILL.md | e09034ea26b7 |

> **Warning:** Image reeval-sandbox:cursor-0.1.9 isn't pushed, so an exact rerun needs this machine's image (id fba6d57ff99e).

## Attempt index

| ID | Eval | Coding harness | Arm / Case | Outcome | Tokens | Agent time | Tools | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-cases-ada-fake-plain-docker-1-67d3066d"></a>A1 | cases | fake | plain / Ada | fail | not reported | 233ms | 1 | 2 files, +2 / -0 | [transcript](./cases-ada-756e9f/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./cases-ada-756e9f/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-cases-ada-fake-with-house-greeting-docker-1-d1909c44"></a>A2 | cases | fake | with-house-greeting / Ada | pass | not reported | 115ms | 1 | 1 files, +1 / -0 | [transcript](./cases-ada-756e9f/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./cases-ada-756e9f/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-cases-grace-fake-plain-docker-1-82c26d96"></a>A3 | cases | fake | plain / Grace | fail | not reported | 232ms | 1 | 2 files, +2 / -0 | [transcript](./cases-grace-113891/fake-plain-docker-98d88a/1/transcript.jsonl), [diff](./cases-grace-113891/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-cases-grace-fake-with-house-greeting-docker-1-56cbf060"></a>A4 | cases | fake | with-house-greeting / Grace | pass | not reported | 102ms | 1 | 1 files, +1 / -0 | [transcript](./cases-grace-113891/fake-with-house-greeting-docker-a9116f/1/transcript.jsonl), [diff](./cases-grace-113891/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-fails-its-check-and-its-judge-fake-fake-fake-1-c538b874"></a>A5 | fails-its-check-and-its-judge | fake | fake | fail | not reported | 1ms | 1 | 2 files, +2 / -0 | [transcript](./fails-its-check-and-its-judge-19bdf6/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./fails-its-check-and-its-judge-19bdf6/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-never-starts-broken-fake-fake-1-f473d78e"></a>A6 | never-starts | broken | fake | infra_error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-skill-fake-plain-docker-1-026c9924"></a>A7 | skill | fake | plain | pass | not reported | 288ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/1/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/1/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/1/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-1-95daf7b7"></a>A8 | skill | fake | with-house-greeting | pass | not reported | 108ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/1/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/1/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
| <a id="attempt-skill-fake-plain-docker-2-feddbfa4"></a>A9 | skill | fake | plain | pass | not reported | 231ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/2/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/2/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/2/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-2-eaec386a"></a>A10 | skill | fake | with-house-greeting | pass | not reported | 117ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/2/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/2/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
| <a id="attempt-writes-greet-js-fake-fake-fake-1-315d3e0e"></a>A11 | writes-greet-js | fake | fake | pass | not reported | 1ms | 1 | 2 files, +2 / -0 | [diff](./writes-greet-js-b165c7/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-skill-fake-plain-docker-3-28d1fff7"></a>A12 | skill | fake | plain | pass | not reported | 282ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/3/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/3/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/3/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-3-2ce5a2c1"></a>A13 | skill | fake | with-house-greeting | pass | not reported | 107ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/3/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/3/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
| <a id="attempt-skill-fake-plain-docker-4-08a05bdd"></a>A14 | skill | fake | plain | pass | not reported | 246ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/4/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/4/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/4/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-4-3f921778"></a>A15 | skill | fake | with-house-greeting | pass | not reported | 111ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/4/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/4/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
