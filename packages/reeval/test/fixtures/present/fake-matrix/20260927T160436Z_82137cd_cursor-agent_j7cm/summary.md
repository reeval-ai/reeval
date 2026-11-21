# Run 20260927T160436Z_82137cd_cursor-agent_j7cm

2 of 4 counted attempts passed · 5 infra errors. 907ms wall time. Tokens: not reported. Cost: not reported. 82137cd.

Run `20260927T160436Z_82137cd_cursor-agent_j7cm` by cursor-agent, 2026-09-27, reeval 0.0.1, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/transcript.jsonl)
> - fails its check: 1 counted attempt reported no token usage; token medians omit them. [A3](./evals-greet-es-ts-fails-its-check-c4ea17/fake-fake-70e87d/1/transcript.jsonl)
> - fails its judge: 1 counted attempt reported no token usage; token medians omit them. [A5](./evals-greet-es-ts-fails-its-judge-fa3d03/fake-fake-70e87d/1/transcript.jsonl)
> - house greeting › greets in the house style: 2 counted attempts reported no token usage; token medians omit them. [A7](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-fake-70e87d/1/transcript.jsonl), [A8](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | fake-1[fast=true] | n/a | 5 attempts |
| broken | n/a | n/a | 5 attempts |

## writes greet.js

`evals/greet.es.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: infra error.

**100% passed**

1 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 8ms | not reported | n/a |
| [A2](#attempt-evals-greet-es-ts-writes-greet-js-broken-fake-1-34ddfa0b) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A2](#attempt-evals-greet-es-ts-writes-greet-js-broken-fake-1-34ddfa0b) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

### Judgments

| Judgment | Question | Threshold | Median |
| --- | --- | --- | --- |
| Does greet.js export greet | Does greet.js export greet? | diagnostic | 0.80 |

Scores for Does greet.js export greet: [A1](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/transcript.jsonl) 0.80.

## fails its check

`evals/greet.es.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**0% passed**

0 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A3](./evals-greet-es-ts-fails-its-check-c4ea17/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 8ms | not reported | expected command to succeed, exit code 1 |
| [A4](#attempt-evals-greet-es-ts-fails-its-check-broken-fake-1-99845ba1) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | expected command to succeed, exit code 1 | n/a | n/a | 1 of 2, all on Fake | [A3](./evals-greet-es-ts-fails-its-check-c4ea17/fake-fake-70e87d/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A4](#attempt-evals-greet-es-ts-fails-its-check-broken-fake-1-99845ba1) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## fails its judge

`evals/greet.es.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**0% passed**

0 of 1 attempt. Left out: 1 infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./evals-greet-es-ts-fails-its-judge-fa3d03/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 2ms | not reported | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) |
| [A6](#attempt-evals-greet-es-ts-fails-its-judge-broken-fake-1-d48578be) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | judge score 0.80 is below 0.95 for "Is greet.js perfect?" (fake) | n/a | n/a | 1 of 2, all on Fake | [A5](./evals-greet-es-ts-fails-its-judge-fa3d03/fake-fake-70e87d/1/transcript.jsonl) |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 2, all on broken | [A6](#attempt-evals-greet-es-ts-fails-its-judge-broken-fake-1-d48578be) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

### Judgments

| Judgment | Question | Threshold | Median |
| --- | --- | --- | --- |
| Is greet.js perfect | Is greet.js perfect? | diagnostic | 0.80 |

Scores for Is greet.js perfect: [A5](./evals-greet-es-ts-fails-its-judge-fa3d03/fake-fake-70e87d/1/transcript.jsonl) 0.80.

## is skipped for now

`evals/greet.es.ts`. Task. 2 coding harnesses, 0 attempts. Verdict: skipped.

## greets in Welsh

`evals/greet.es.ts`. Task. 1 coding harness, 0 attempts. Verdict: todo.

## house greeting › greets in the house style

`evals/skill.es.ts`. Task. 2 coding harnesses, 2 arms, 4 attempts. Verdict: infra error.

**baseline 0% vs with-house-greeting 100%**

0 of 1 vs 1 of 1 attempt. Left out: 2 infra errors.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| baseline | 0% | 0 of 1 | baseline | 1 infra error |
| with-house-greeting | 100% | 1 of 1 | variant | 1 infra error |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A7](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-fake-70e87d/1/transcript.jsonl) | Fake | baseline | fail | not reported | 11ms | not reported | expected command to succeed, exit code 1 |
| [A8](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl) | Fake | with-house-greeting | pass | not reported | 2ms | not reported | n/a |
| [A9](#attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-b-3d3b0ac5) | broken | baseline | infra error | not reported | 0ms | not reported | the fake sandbox fell over |
| [A10](#attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-b-2ef8d09d) | broken | with-house-greeting | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 2 of 4, all on broken | [A9](#attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-b-3d3b0ac5), [A10](#attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-b-2ef8d09d) |
| error | expected command to succeed, exit code 1 | n/a | n/a | 1 of 4, all on baseline, not gated | [A7](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-fake-70e87d/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| baseline | not reported | 1 | <0.1s | not reported | not reported |
| with-house-greeting | not reported | 1 | <0.1s | not reported | not reported |

## Tally

Evals: 2 fail · 2 infra errors · 1 skipped · 1 todo.

## State

| Field | Value |
| --- | --- |
| Executed at | 82137cd5adbc on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | broken, fake (served fake-1[fast=true]) |
| Environments | with-house-greeting 7b5dd0e29b0d · skills house-greeting |
| Judge | fake · threshold 0.8 · version 6334f0ba15cf |
| Packages | vitest 5.0.2 · @evalsuite/harness-antigravity 0.1.0 · @evalsuite/harness-opencode 0.1.0 · @evalsuite/harness-goose 0.1.0 · @evalsuite/harness-pi 0.1.0 · @evalsuite/harness-cursor-sdk 0.1.0 · @ai-sdk/harness-claude-code 1.0.128-patch.5d1c985c · @evalsuite/harness-codex 0.1.0 · ai 7.0.114 · @ai-sdk/harness 1.0.124 · @ai-sdk/google 4.0.79 · @ai-sdk/typesafe-ai 3.0.6 |
| reeval | 0.0.1 · node 22.14.0 · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Arm | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-greet-es-ts-writes-greet-js-fake-fake-1-4db1d21c"></a>A1 | writes greet.js | Fake | n/a | pass | not reported | 8ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-es-ts-writes-greet-js-4857ff/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-es-ts-writes-greet-js-broken-fake-1-34ddfa0b"></a>A2 | writes greet.js | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-es-ts-fails-its-check-fake-fake-1-69f56e17"></a>A3 | fails its check | Fake | n/a | fail | not reported | 8ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-es-ts-fails-its-check-c4ea17/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-es-ts-fails-its-check-c4ea17/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-es-ts-fails-its-check-broken-fake-1-99845ba1"></a>A4 | fails its check | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-greet-es-ts-fails-its-judge-fake-fake-1-b228c06e"></a>A5 | fails its judge | Fake | n/a | fail | not reported | 2ms | 1 | 2 files (lines not recorded) | [transcript](./evals-greet-es-ts-fails-its-judge-fa3d03/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-greet-es-ts-fails-its-judge-fa3d03/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-greet-es-ts-fails-its-judge-broken-fake-1-d48578be"></a>A6 | fails its judge | broken | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-f-3c55ce08"></a>A7 | house greeting › greets in the house style | Fake | baseline | fail | not reported | 11ms | 1 | 2 files (lines not recorded) | [transcript](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-f-19bfbc23"></a>A8 | house greeting › greets in the house style | Fake | with-house-greeting | pass | not reported | 2ms | 1 | 1 file (lines not recorded) | [transcript](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-with-house-greeting-fake-7a7667/1/transcript.jsonl), [diff](./evals-skill-es-ts-house-greeting-greets-in-the-house-style-55be48/fake-with-house-greeting-fake-7a7667/1/diff.patch) |
| <a id="attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-b-3d3b0ac5"></a>A9 | house greeting › greets in the house style | broken | baseline | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-skill-es-ts-house-greeting-greets-in-the-house-style-b-2ef8d09d"></a>A10 | house greeting › greets in the house style | broken | with-house-greeting | infra error | not reported | 0ms | 0 | not recorded | n/a |
