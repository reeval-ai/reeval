# Run 20261127T123011Z_b479de5_cursor-agent_nmb3

7 of 8 counted attempts passed, 1 infra errors. 31s wall time. No USD cost recorded. b479de5.

Run `20261127T123011Z_b479de5_cursor-agent_nmb3` by cursor-agent, 2026-11-27, reeval 0.31.0, varying runs per cell.

> [!WARNING]
> Integrity: read these before the results.
>
> - 4 counted attempts reported no token usage; token medians omit them. [A1](./cases-ada-756e9f/fake-plain-docker-98d88a/1/trajectory.jsonl), [A2](./cases-ada-756e9f/fake-with-house-greeting-docker-a9116f/1/trajectory.jsonl), [A3](./cases-grace-113891/fake-plain-docker-98d88a/1/trajectory.jsonl), [A4](./cases-grace-113891/fake-with-house-greeting-docker-a9116f/1/trajectory.jsonl)
> - 1 counted attempt reported no token usage; token medians omit them. [A5](./fails-a-grader-and-a-judge-2e648e/fake-fake-fake-dc13e2/1/trajectory.jsonl)
> - 8 counted attempts reported no token usage; token medians omit them. [A7](./skill-9c53c0/fake-plain-docker-98d88a/1/diff.patch), [A9](./skill-9c53c0/fake-plain-docker-98d88a/2/diff.patch), [A12](./skill-9c53c0/fake-plain-docker-98d88a/3/diff.patch), [A14](./skill-9c53c0/fake-plain-docker-98d88a/4/diff.patch), [A8](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/1/diff.patch), [A10](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/2/diff.patch), [A13](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/3/diff.patch), [A15](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/4/diff.patch)
> - 1 counted attempt reported no token usage; token medians omit them. [A11](./writes-greet-js-b165c7/fake-fake-fake-dc13e2/1/diff.patch)

## Summary

The house-style skill lifts the pass rate.

| Evaluation | Shape / arms | Primary result | Effort |
| --- | --- | --- | --- |
| [cases](#cases) | ab; 2 prompts, 1 coding harness, 2 arms, 4 attempts | with-house-greeting vs plain: +100 pts pass rate (100% vs 0%) | not reported |
| [fails-a-grader-and-a-judge](#fails-a-grader-and-a-judge) | task; 1 coding harness, 1 attempt | mean 50% · 0/1 run at 100% (pass@1) · capability(1) | not reported |
| [greets-in-welsh](#greets-in-welsh) | task; 1 coding harness, 0 attempts | skipped | not reported |
| [is-skipped-for-now](#is-skipped-for-now) | task; 1 coding harness, 0 attempts | skipped | not reported |
| [never-starts](#never-starts) | task; 1 coding harness, 1 attempt | infra error · capability(1) | not reported |
| [skill](#skill) | ab; 1 coding harness, 2 arms, 8 attempts | with-house-greeting vs plain: ±0 pts pass rate (100% vs 100%) | not reported |
| [writes-greet-js](#writes-greet-js) | task; 1 coding harness, 1 attempt | mean 100% · 1/1 run at 100% (pass@1) · capability(1) | not reported |

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
| plain | 0% | n/a | Baseline | not reported | 1 | 1 | not reported | 0.7s | 2 | 2 | 0 |
| with-house-greeting | 100% | +100 pts | Too few runs | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.3s (-61%) | 1 (-50%) | 1 (-50%) | 0 |

### Effort by coding harness

| Coding harness | Arm | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fake | plain | 0% | not reported | 1 | 1 | not reported | 0.7s | 2 | 2 | 0 |
| fake | with-house-greeting | 100% | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.3s (-61%) | 1 (-50%) | 1 (-50%) | 0 |

### Failures and caveats

| Kind | Label | At | Count | Attempts |
| --- | --- | --- | --- | --- |
| error | score 0.00 below 1: succeeded:grep -q Ahoy greet.js scored 0.00 | n/a | 2 of 4 | [A1](./cases-ada-756e9f/fake-plain-docker-98d88a/1/trajectory.jsonl), [A3](./cases-grace-113891/fake-plain-docker-98d88a/1/trajectory.jsonl) |

#### Worth knowing

- (concern) The with-house-greeting variant, paired over 2 cases: better, but a paired lift needs 6 cases that differ between the arms to hold. It runs 2.5× faster, but 2 cases can't confirm it; 5 is the least that can. Fix at evals/cases.eval.ts: add cases, so 6 or more can differ between the arms.

## fails-a-grader-and-a-judge

`evals/fails-a-grader-and-a-judge.eval.ts`. Task. 1 coding harness, 1 attempt.

**mean 50% · 0/1 run at 100% (pass@1)** · capability(1)

Report only: the target never fails the run. 1 counted attempt, 1 coding harness.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

### Failures and caveats

| Kind | Label | At | Count | Attempts |
| --- | --- | --- | --- | --- |
| error | score 0.50 below 1: succeeded:grep -q Bonjour greet.js scored 0.00 | n/a | 1 of 1 | [A5](./fails-a-grader-and-a-judge-2e648e/fake-fake-fake-dc13e2/1/trajectory.jsonl) |

## greets-in-welsh

`evals/greets-in-welsh.eval.ts`. Task. 1 coding harness, 0 attempts.

**skipped**

Not run.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

## is-skipped-for-now

`evals/is-skipped-for-now.eval.ts`. Task. 1 coding harness, 0 attempts.

**skipped**

Not run.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

## never-starts

`evals/never-starts.eval.ts`. Task. 1 coding harness, 1 attempt.

**infra error** · capability(1)

No attempt counted: each ended in an infra error.

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

**with-house-greeting vs plain: ±0 pts pass rate (100% vs 100%)**

n = 4 vs 4 counted attempts. 95% CI -49 pts to +49 pts. The interval spans 0: within noise.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

### Baseline vs. variants

- **plain** (`sha256:eca09e8f139fb2456ce711a4f177ce81d9a5fdef6f8cdc80e9746ba8c5a9aae9`): baseline
- **with-house-greeting** (`sha256:7b5dd0e29b0dce7a2b796abca66e941ba97b932c7ddbf22e4efc09f381b2a5f7`): variant: with-house-greeting

| Arm | Pass rate | Lift | Pass-rate verdict | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| plain | 100% | n/a | Baseline | not reported | 1 | 1 | not reported | 0.6s | 2 | 2 | 0 |
| with-house-greeting | 100% | ±0 pts | Within noise | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.3s (-46%) | 1 (-50%) | 1 (-50%) | 0 |

### Effort by coding harness

| Coding harness | Arm | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fake | plain | 100% | not reported | 1 | 1 | not reported | 0.6s | 2 | 2 | 0 |
| fake | with-house-greeting | 100% | not reported | 1 (±0%) | 1 (±0%) | not reported | 0.3s (-46%) | 1 (-50%) | 1 (-50%) | 0 |

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

**mean 100% · 1/1 run at 100% (pass@1)** · capability(1)

Report only: the target never fails the run. 1 counted attempt, 1 coding harness.

### Key findings

- Every eval ran once.
- The variant passed where the control failed.
- The broken harness never started.

## Recommended actions

- Rerun the compare

## State

| Field | Value |
| --- | --- |
| Executed at | b479de5c00ef on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.9 · id ca9cdeb96dd1 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Agents | broken, fake (served fake-1[fast=true]) |
| Resources | docker 2 vCPU 4.0 GiB: 12 attempts · CPU 2.1 s (avg 0.10, peak 0.13 cores) · memory peak 21 MiB |
| Environments | fake eca09e8f139f; plain eca09e8f139f; with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version 0899605ae6f9 |
| Packages | jiti 2.7.0 · @reeval/harness-antigravity 0.1.17 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.17 · @reeval/harness-pi 0.2.10 · @reeval/harness-cursor-sdk 0.1.9 · @ai-sdk/harness-claud… |
| reeval | 0.31.0 · node 26.13.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | evidence |
| Record | [20261127T123011Z_b479de5_cursor-agent_nmb3.json](../20261127T123011Z_b479de5_cursor-agent_nmb3.json) |
| Context | 1 files |

| Path | sha256 |
| --- | --- |
| ~/.agents/skills/house-greeting/SKILL.md | e09034ea26b7 |

> **Warning:** Image reeval-sandbox:cursor-0.1.9 isn't pushed, so an exact rerun needs this machine's image (id ca9cdeb96dd1).

## Attempt index

| ID | Eval | Coding harness | Arm / Case | Outcome | Tokens | Agent time | Tools | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-cases-ada-fake-plain-docker-1-67d3066d"></a>A1 | cases | fake | plain / Ada | fail | not reported | 614ms | 1 | 2 files, +2 / -0 | [trajectory](./cases-ada-756e9f/fake-plain-docker-98d88a/1/trajectory.jsonl), [diff](./cases-ada-756e9f/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-cases-ada-fake-with-house-greeting-docker-1-d1909c44"></a>A2 | cases | fake | with-house-greeting / Ada | pass | not reported | 248ms | 1 | 1 files, +1 / -0 | [trajectory](./cases-ada-756e9f/fake-with-house-greeting-docker-a9116f/1/trajectory.jsonl), [diff](./cases-ada-756e9f/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-cases-grace-fake-plain-docker-1-82c26d96"></a>A3 | cases | fake | plain / Grace | fail | not reported | 717ms | 1 | 2 files, +2 / -0 | [trajectory](./cases-grace-113891/fake-plain-docker-98d88a/1/trajectory.jsonl), [diff](./cases-grace-113891/fake-plain-docker-98d88a/1/diff.patch) |
| <a id="attempt-cases-grace-fake-with-house-greeting-docker-1-56cbf060"></a>A4 | cases | fake | with-house-greeting / Grace | pass | not reported | 276ms | 1 | 1 files, +1 / -0 | [trajectory](./cases-grace-113891/fake-with-house-greeting-docker-a9116f/1/trajectory.jsonl), [diff](./cases-grace-113891/fake-with-house-greeting-docker-a9116f/1/diff.patch) |
| <a id="attempt-fails-a-grader-and-a-judge-fake-fake-fake-1-0a15d328"></a>A5 | fails-a-grader-and-a-judge | fake | fake | fail | not reported | 13ms | 1 | 2 files, +2 / -0 | [trajectory](./fails-a-grader-and-a-judge-2e648e/fake-fake-fake-dc13e2/1/trajectory.jsonl), [diff](./fails-a-grader-and-a-judge-2e648e/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-never-starts-broken-fake-fake-1-f473d78e"></a>A6 | never-starts | broken | fake | infra_error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-skill-fake-plain-docker-1-026c9924"></a>A7 | skill | fake | plain | pass | not reported | 667ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/1/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/1/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/1/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-1-95daf7b7"></a>A8 | skill | fake | with-house-greeting | pass | not reported | 353ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/1/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/1/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
| <a id="attempt-skill-fake-plain-docker-2-feddbfa4"></a>A9 | skill | fake | plain | pass | not reported | 568ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/2/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/2/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/2/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-2-eaec386a"></a>A10 | skill | fake | with-house-greeting | pass | not reported | 346ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/2/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/2/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
| <a id="attempt-writes-greet-js-fake-fake-fake-1-315d3e0e"></a>A11 | writes-greet-js | fake | fake | pass | not reported | 13ms | 1 | 2 files, +2 / -0 | [diff](./writes-greet-js-b165c7/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-skill-fake-plain-docker-3-28d1fff7"></a>A12 | skill | fake | plain | pass | not reported | 556ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/3/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/3/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/3/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-3-2ce5a2c1"></a>A13 | skill | fake | with-house-greeting | pass | not reported | 263ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/3/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/3/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
| <a id="attempt-skill-fake-plain-docker-4-08a05bdd"></a>A14 | skill | fake | plain | pass | not reported | 531ms | 1 | 2 files, +2 / -0 | [diff](./skill-9c53c0/fake-plain-docker-98d88a/4/diff.patch), [q1](./skill-9c53c0/fake-plain-docker-98d88a/4/questions/3.json), [q2](./skill-9c53c0/fake-plain-docker-98d88a/4/questions/4.json) |
| <a id="attempt-skill-fake-with-house-greeting-docker-4-3f921778"></a>A15 | skill | fake | with-house-greeting | pass | not reported | 215ms | 1 | 1 files, +1 / -0 | [diff](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/4/diff.patch), [q1](./skill-9c53c0/fake-with-house-greeting-docker-a9116f/4/questions/3.json), [q2](./skill-9c53c0/fake-with-house-greetin… |
