# Run 20261103T125317Z_8cab9fc_cursor-agent_cpnp

0 of 3 counted attempts passed. 891ms wall time. Tokens: not reported. Cost: not reported. 8cab9fc.

Run `20261103T125317Z_8cab9fc_cursor-agent_cpnp` by cursor-agent, 2026-11-03, reeval 0.18.0, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - discovery: %s: 4 counted attempts reported no token usage; token medians omit them. [A1](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-plain-fake-57f9db/1/transcript.jsonl), [A2](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A3](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-plain-fake-57f9db/1/transcript.jsonl), [A4](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-with-skill-fake-14b6ac/1/transcript.jsonl)
> - renamed options › writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A5](./evals-options-eval-ts-renamed-options-writes-greet-js-b9f9b0/fake-app-fake-e80a19/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 5 attempts |

## discovery: %s

`evals/discovery.eval.ts`. A/B. 2 prompts, 1 coding harness, 2 arms, 4 attempts. Verdict: fail.

**0% passed**

0 of 2 attempts.

### By task

| Task | plain |
| --- | --- |
| add user authentication | 0% (0 of 2) |
| add social login and email/password auth | 0% (0 of 2) |

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | add user authentication | fail | not reported | 0ms | not reported | expected file greet.js to exist |
| [A2](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | add user authentication | fail | not reported | 0ms | not reported | expected file greet.js to exist |
| [A3](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | add social login and email/password auth | fail | not reported | 0ms | not reported | expected file greet.js to exist |
| [A4](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | add social login and email/password auth | fail | not reported | 0ms | not reported | expected file greet.js to exist |

### Checks

| Check | Matcher | At | plain | Total |
| --- | --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | evals/discovery.eval.ts:13 | 0 of 4 | 0 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toHaveFile greet.js | expected file greet.js to exist | evals/discovery.eval.ts:13 | 4 of 4 | [A1](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-plain-fake-57f9db/1/transcript.jsonl), [A2](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A3](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-plain-fake-57f9db/1/transcript.jsonl), [A4](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-with-skill-fake-14b6ac/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## renamed options › writes greet.js

`evals/options.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A5](./evals-options-eval-ts-renamed-options-writes-greet-js-b9f9b0/fake-app-fake-e80a19/1/transcript.jsonl) | Fake | fail | not reported | 0ms | not reported | expected file greet.js to exist |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toHaveFile greet.js | toHaveFile | evals/options.eval.ts:11 | 0 of 1 | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | toHaveFile greet.js | expected file greet.js to exist | evals/options.eval.ts:11 | 1 of 1 | [A5](./evals-options-eval-ts-renamed-options-writes-greet-js-b9f9b0/fake-app-fake-e80a19/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## Tally

Evals: 2 fail.

## State

| Field | Value |
| --- | --- |
| Executed at | 8cab9fcb3828 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | app eca09e8f139f; plain eca09e8f139f; with-skill eca09e8f139f |
| Judge | none by default · threshold 0.8 · version 991ce2915785 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.13 · @reeval/harness-opencode 0.2.13 · @reeval/harness-goose 0.1.10 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.8 · @ai-sdk/harness-claude-code 1.0.171-patch.8cc1b324 · @reeval/harness-codex 0.1.10 · @reeval/harness-fx 0.1.5 · @reeval/harness-grok-build 0.1.8 · ai 7.0.156 · @ai-sdk/harness 1.0.167 · @ai-sdk/anthropic 4.0.91 · @ai-sdk/google 4.0.107 · @ai-sdk/openai 4.0.104 · @ai-sdk/typesafe-ai 3.0.29 |
| reeval | 0.18.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Case | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-discovery-eval-ts-discovery-add-user-authentication-fa-337001ea"></a>A1 | discovery: %s | Fake | add user authentication | fail | not reported | 0ms | 0 | not recorded | [transcript](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-discovery-eval-ts-discovery-add-user-authentication-fa-f2b6cfbf"></a>A2 | discovery: %s | Fake | add user authentication | fail | not reported | 0ms | 0 | not recorded | [transcript](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-discovery-eval-ts-discovery-add-user-authentication-e8dd58/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-discovery-eval-ts-discovery-add-social-login-and-email-8cd5764c"></a>A3 | discovery: %s | Fake | add social login and email/password auth | fail | not reported | 0ms | 0 | not recorded | [transcript](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-discovery-eval-ts-discovery-add-social-login-and-email-cb4c258a"></a>A4 | discovery: %s | Fake | add social login and email/password auth | fail | not reported | 0ms | 0 | not recorded | [transcript](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-discovery-eval-ts-discovery-add-social-login-and-email-ea6ace/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-options-eval-ts-renamed-options-writes-greet-js-fake-a-7aa1685a"></a>A5 | renamed options › writes greet.js | Fake | n/a | fail | not reported | 0ms | 0 | not recorded | [transcript](./evals-options-eval-ts-renamed-options-writes-greet-js-b9f9b0/fake-app-fake-e80a19/1/transcript.jsonl), [diff](./evals-options-eval-ts-renamed-options-writes-greet-js-b9f9b0/fake-app-fake-e80a19/1/diff.patch) |
