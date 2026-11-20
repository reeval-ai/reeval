# Run 20261101T084156Z_0ce3c84_cursor-agent_3c65

10 of 13 counted attempts passed. 1s wall time. Tokens: not reported. Cost: not reported. 0ce3c84.

Run `20261101T084156Z_0ce3c84_cursor-agent_3c65` by cursor-agent, 2026-11-01, reeval 0.17.2, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - rated: 3 counted attempts reported no token usage; token medians omit them. [A1](./evals-cases-eval-ts-rated-a-abff7a/fake-fake-fake-dc13e2/1/transcript.jsonl), [A2](./evals-cases-eval-ts-rated-b-bb88b3/fake-fake-fake-dc13e2/1/transcript.jsonl), [A3](./evals-cases-eval-ts-rated-c-3922df/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - strict: 4 counted attempts reported no token usage; token medians omit them. [A4](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/1/transcript.jsonl), [A17](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/2/transcript.jsonl), [A5](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/1/transcript.jsonl), [A18](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/2/transcript.jsonl)
> - lands: 2 counted attempts reported no token usage; token medians omit them. [A6](#attempt-evals-cases-eval-ts-lands-next-fake-next-app-fake-1-c813fa57), [A7](#attempt-evals-cases-eval-ts-lands-vite-fake-vite-app-fake-1-c28ccb36)
> - lifted: Check "has the skill" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - lifted: 6 counted attempts reported no token usage; token medians omit them. [A8](./evals-cases-eval-ts-lifted-ada-39ad15/fake-plain-fake-57f9db/1/transcript.jsonl), [A9](./evals-cases-eval-ts-lifted-ada-39ad15/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A10](./evals-cases-eval-ts-lifted-grace-7415c1/fake-plain-fake-57f9db/1/transcript.jsonl), [A11](./evals-cases-eval-ts-lifted-grace-7415c1/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A12](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-plain-fake-57f9db/1/transcript.jsonl), [A13](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-with-skill-fake-14b6ac/1/transcript.jsonl)
> - alone: 1 counted attempt reported no token usage; token medians omit them. [A14](./evals-cases-eval-ts-alone-only-36f851/fake-fake-fake-dc13e2/1/transcript.jsonl)
> - picks: 2 counted attempts reported no token usage; token medians omit them. [A15](./evals-cases-eval-ts-picks-p1-ceb45b/fake-fake-fake-dc13e2/1/transcript.jsonl), [A16](./evals-cases-eval-ts-picks-p2-834bea/fake-fake-fake-dc13e2/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 18 attempts |

## rated

`evals/cases.eval.ts`. Task. 3 prompts, 1 coding harness, 3 attempts. Verdict: pass.

**67% passed**

2 of 3 attempts.

### By task

| Task | fake | total |
| --- | --- | --- |
| a | 100% (1 of 1) | 100% (1 of 1) |
| b | 100% (1 of 1) | 100% (1 of 1) |
| c | 0% (0 of 1) | 0% (0 of 1) |

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-cases-eval-ts-rated-a-abff7a/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | a | pass | not reported | 3ms | not reported | n/a |
| [A2](./evals-cases-eval-ts-rated-b-bb88b3/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | b | pass | not reported | 4ms | not reported | n/a |
| [A3](./evals-cases-eval-ts-rated-c-3922df/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | c | fail | not reported | 6ms | not reported | passes its case: expected 'c' not to be 'c' // Object.is equality |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| passes its case | not.toBe | evals/cases.eval.ts:14 | 2 of 3 | 2 of 3 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | passes its case | expected 'c' not to be 'c' // Object.is equality | evals/cases.eval.ts:14 | 1 of 3 | [A3](./evals-cases-eval-ts-rated-c-3922df/fake-fake-fake-dc13e2/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## strict

`evals/cases.eval.ts`. Task. 2 prompts, 1 coding harness, 4 attempts. Verdict: fail.

**50% passed**

2 of 4 attempts.

### By task

| Task | fake | total |
| --- | --- | --- |
| x | 100% (2 of 2) | 100% (2 of 2) |
| y | 0% (0 of 2) | 0% (0 of 2) |

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A4](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | x | pass | not reported | 25ms | not reported | n/a |
| [A5](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | y | fail | not reported | 1ms | not reported | passes its case: expected 'y' to be 'x' // Object.is equality |
| [A17](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/2/transcript.jsonl) | Fake | x | pass | not reported | 0ms | not reported | n/a |
| [A18](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/2/transcript.jsonl) | Fake | y | fail | not reported | 6ms | not reported | passes its case: expected 'y' to be 'x' // Object.is equality |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| passes its case | toBe | evals/cases.eval.ts:20 | 2 of 4 | 2 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | passes its case | expected 'y' to be 'x' // Object.is equality | evals/cases.eval.ts:20 | 2 of 4 | [A5](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/1/transcript.jsonl), [A18](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/2/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## lands

`evals/cases.eval.ts`. Task. 1 coding harness, 2 arms, 2 attempts. Verdict: pass.

**next-app 100% vs vite-app 100%**

1 of 1 vs 1 of 1 attempt.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| next-app | 100% | 1 of 1 | baseline | none |
| vite-app | 100% | 1 of 1 | variant | none |

### By task

| Task | fake | total |
| --- | --- | --- |
| next | 100% (1 of 1) | 100% (1 of 1) |
| vite | 100% (1 of 1) | 100% (1 of 1) |

### Attempts

| Attempt | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [A6](#attempt-evals-cases-eval-ts-lands-next-fake-next-app-fake-1-c813fa57) | Fake | next-app | next | pass | not reported | 0ms | not reported | n/a |
| [A7](#attempt-evals-cases-eval-ts-lands-vite-fake-vite-app-fake-1-c28ccb36) | Fake | vite-app | vite | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| runs on its own stack | toBe | evals/cases.eval.ts:32 | 2 of 2 | 2 of 2 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| next-app | not reported | 0 | <0.1s | not reported | not reported |
| vite-app | not reported | 0 | <0.1s | not reported | not reported |

### Next

- Saturated: every arm hit 100% across all tasks. This comparison catches regressions; add harder tasks to separate variants.

## lifted

`evals/cases.eval.ts`. A/B. 3 prompts, 1 coding harness, 2 arms, 6 attempts. Verdict: fail.

**plain 0% vs with-skill 100%: too few runs, not by minLift 50**

0 of 3 vs 3 of 3 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 3 | baseline | none |
| with-skill | 100% | 3 of 3 | too few runs, not by minLift 50 | none |

### By task

| Task | plain | with-skill |
| --- | --- | --- |
| Ada | 0% (0 of 1) | 100% (1 of 1) |
| Grace | 0% (0 of 1) | 100% (1 of 1) |
| Linus | 0% (0 of 1) | 100% (1 of 1) |

### Attempts

| Attempt | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [A8](./evals-cases-eval-ts-lifted-ada-39ad15/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | Ada | fail | not reported | 1ms | not reported | has the skill: expected command to succeed, exit code 1 |
| [A9](./evals-cases-eval-ts-lifted-ada-39ad15/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | Ada | pass | not reported | 4ms | not reported | n/a |
| [A10](./evals-cases-eval-ts-lifted-grace-7415c1/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | Grace | fail | not reported | 0ms | not reported | has the skill: expected command to succeed, exit code 1 |
| [A11](./evals-cases-eval-ts-lifted-grace-7415c1/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | Grace | pass | not reported | 5ms | not reported | n/a |
| [A12](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | Linus | fail | not reported | 4ms | not reported | has the skill: expected command to succeed, exit code 1 |
| [A13](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | Linus | pass | not reported | 5ms | not reported | n/a |

### Checks

| Check | Matcher | At | plain | with-skill | Total |
| --- | --- | --- | --- | --- | --- |
| has the skill | toSucceed | evals/cases.eval.ts:42 | 0 of 3 | 3 of 3 | 3 of 6 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | has the skill | expected command to succeed, exit code 1 | evals/cases.eval.ts:42 | 3 of 6, all on plain, not gated | [A8](./evals-cases-eval-ts-lifted-ada-39ad15/fake-plain-fake-57f9db/1/transcript.jsonl), [A10](./evals-cases-eval-ts-lifted-grace-7415c1/fake-plain-fake-57f9db/1/transcript.jsonl), [A12](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-plain-fake-57f9db/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-skill | not reported | 0 | <0.1s | not reported | not reported |

## alone

`evals/cases.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A14](./evals-cases-eval-ts-alone-only-36f851/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | only | pass | not reported | 6ms | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## picks

`evals/cases.eval.ts`. Task. 2 prompts, 1 coding harness, 2 attempts. Verdict: not gated.

**100% passed**

2 of 2 attempts.

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A15](./evals-cases-eval-ts-picks-p1-ceb45b/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | p1 | pass | not reported | 4ms | not reported | n/a |
| [A16](./evals-cases-eval-ts-picks-p2-834bea/fake-fake-fake-dc13e2/1/transcript.jsonl) | Fake | p2 | pass | not reported | 1ms | not reported | n/a |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

### Next

- (observed) pick: drizzle 1 · prisma 1

## Tally

Evals: 2 fail · 3 pass · 1 not gated.

## State

| Field | Value |
| --- | --- |
| Executed at | 0ce3c84c12a9 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | fake eca09e8f139f; next-app 39d20a9bc50f; plain eca09e8f139f; vite-app f1698ffe2837; with-skill e4cf82b6720e |
| Judge | none by default · threshold 0.8 · version 1c314a6e4c08 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.13 · @reeval/harness-opencode 0.2.13 · @reeval/harness-goose 0.1.10 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.8 · @ai-sdk/harness-claude-code 1.0.171-patch.8cc1b324 · @reeval/harness-codex 0.1.10 · @reeval/harness-fx 0.1.5 · @reeval/harness-grok-build 0.1.8 · ai 7.0.156 · @ai-sdk/harness 1.0.167 · @ai-sdk/anthropic 4.0.91 · @ai-sdk/google 4.0.107 · @ai-sdk/openai 4.0.104 · @ai-sdk/typesafe-ai 3.0.29 |
| reeval | 0.17.2 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-cases-eval-ts-rated-a-fake-fake-fake-1-76d6255d"></a>A1 | rated | Fake | n/a | a | pass | not reported | 3ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-rated-a-abff7a/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-rated-a-abff7a/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-rated-b-fake-fake-fake-1-84f730e2"></a>A2 | rated | Fake | n/a | b | pass | not reported | 4ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-rated-b-bb88b3/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-rated-b-bb88b3/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-rated-c-fake-fake-fake-1-81b3f213"></a>A3 | rated | Fake | n/a | c | fail | not reported | 6ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-rated-c-3922df/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-rated-c-3922df/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-strict-x-fake-fake-fake-1-7c6a6431"></a>A4 | strict | Fake | n/a | x | pass | not reported | 25ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-strict-y-fake-fake-fake-1-b165563b"></a>A5 | strict | Fake | n/a | y | fail | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-lands-next-fake-next-app-fake-1-c813fa57"></a>A6 | lands | Fake | next-app | next | pass | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-cases-eval-ts-lands-vite-fake-vite-app-fake-1-c28ccb36"></a>A7 | lands | Fake | vite-app | vite | pass | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-cases-eval-ts-lifted-ada-fake-plain-fake-1-907a627b"></a>A8 | lifted | Fake | plain | Ada | fail | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-lifted-ada-39ad15/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-cases-eval-ts-lifted-ada-39ad15/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-lifted-ada-fake-with-skill-fake-1-ed76eee2"></a>A9 | lifted | Fake | with-skill | Ada | pass | not reported | 4ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-lifted-ada-39ad15/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-cases-eval-ts-lifted-ada-39ad15/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-lifted-grace-fake-plain-fake-1-fd778a7e"></a>A10 | lifted | Fake | plain | Grace | fail | not reported | 0ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-lifted-grace-7415c1/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-cases-eval-ts-lifted-grace-7415c1/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-lifted-grace-fake-with-skill-fake-1-58afdae6"></a>A11 | lifted | Fake | with-skill | Grace | pass | not reported | 5ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-lifted-grace-7415c1/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-cases-eval-ts-lifted-grace-7415c1/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-lifted-linus-fake-plain-fake-1-153ca190"></a>A12 | lifted | Fake | plain | Linus | fail | not reported | 4ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-lifted-linus-fake-with-skill-fake-1-f49cb244"></a>A13 | lifted | Fake | with-skill | Linus | pass | not reported | 5ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-cases-eval-ts-lifted-linus-6dcc1e/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-alone-only-fake-fake-fake-1-f333b73d"></a>A14 | alone | Fake | n/a | only | pass | not reported | 6ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-alone-only-36f851/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-alone-only-36f851/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-picks-p1-fake-fake-fake-1-b97d7821"></a>A15 | picks | Fake | n/a | p1 | pass | not reported | 4ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-picks-p1-ceb45b/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-picks-p1-ceb45b/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-picks-p2-fake-fake-fake-1-a17c9a25"></a>A16 | picks | Fake | n/a | p2 | pass | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-picks-p2-834bea/fake-fake-fake-dc13e2/1/transcript.jsonl), [diff](./evals-cases-eval-ts-picks-p2-834bea/fake-fake-fake-dc13e2/1/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-strict-x-fake-fake-fake-2-df60f7b9"></a>A17 | strict | Fake | n/a | x | pass | not reported | 0ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/2/transcript.jsonl), [diff](./evals-cases-eval-ts-strict-x-6c40d5/fake-fake-fake-dc13e2/2/diff.patch) |
| <a id="attempt-evals-cases-eval-ts-strict-y-fake-fake-fake-2-6bd1c24b"></a>A18 | strict | Fake | n/a | y | fail | not reported | 6ms | 0 | 1 file (lines not recorded) | [transcript](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/2/transcript.jsonl), [diff](./evals-cases-eval-ts-strict-y-ad030a/fake-fake-fake-dc13e2/2/diff.patch) |
