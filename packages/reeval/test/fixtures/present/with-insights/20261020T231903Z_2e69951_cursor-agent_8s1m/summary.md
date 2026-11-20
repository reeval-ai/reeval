# Run 20261020T231903Z_2e69951_cursor-agent_8s1m

22 of 41 counted attempts passed · 1 infra error. 2s wall time. Tokens: not reported. Cost: not reported. 2e69951.

Run `20261020T231903Z_2e69951_cursor-agent_8s1m` by cursor-agent, 2026-10-20, reeval 0.10.0, varying runs per cell.

> [!WARNING]
> Read these before the results.
>
> - recommends Genkit for $task: 6 counted attempts reported no token usage; token medians omit them. [A1](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/1/transcript.jsonl), [A27](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/2/transcript.jsonl), [A3](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/1/transcript.jsonl), [A29](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/2/transcript.jsonl), [A4](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/1/transcript.jsonl), [A30](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/2/transcript.jsonl)
> - adds a $name button that builds: 3 counted attempts reported no token usage; token medians omit them. [A2](./evals-family-eval-ts-adds-a-reset-button-that-builds-5f0694/fake-fake-70e87d/1/transcript.jsonl), [A5](./evals-family-eval-ts-adds-a-double-button-that-builds-f0ec30/fake-fake-70e87d/1/transcript.jsonl), [A6](./evals-family-eval-ts-adds-a-clear-button-that-builds-ddd4f5/fake-fake-70e87d/1/transcript.jsonl)
> - greets %s in the house style: Check "house greeting" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - greets %s in the house style: 8 counted attempts reported no token usage; token medians omit them. [A7](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-plain-fake-57f9db/1/transcript.jsonl), [A8](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A9](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-plain-fake-57f9db/1/transcript.jsonl), [A10](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A11](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-plain-fake-57f9db/1/transcript.jsonl), [A12](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A13](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-plain-fake-57f9db/1/transcript.jsonl), [A14](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-with-skill-fake-14b6ac/1/transcript.jsonl)
> - greets in the house style on each agent: 2 counted attempts reported no token usage; token medians omit them. [A15](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/skilled-fake-cd398f/1/transcript.jsonl), [A16](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/terse-fake-ea7484/1/transcript.jsonl)
> - learns the house style from the skill: Check "house greeting" never passes on the baseline and always passes on a variant on coding harness learner; it may not apply to the baseline.
> - learns the house style from the skill: 16 counted attempts reported no token usage; token medians omit them. [A17](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/1/transcript.jsonl), [A31](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/2/transcript.jsonl), [A45](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/3/transcript.jsonl), [A55](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/4/transcript.jsonl), [A18](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/1/transcript.jsonl), [A32](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/2/transcript.jsonl), [A47](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/3/transcript.jsonl), [A56](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/4/transcript.jsonl), [A19](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/1/transcript.jsonl), [A33](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/2/transcript.jsonl), [A48](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/3/transcript.jsonl), [A57](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/4/transcript.jsonl), [A20](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/1/transcript.jsonl), [A34](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/2/transcript.jsonl), [A49](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/3/transcript.jsonl), [A58](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/4/transcript.jsonl)
> - greets in the house style: Check "house greeting" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - greets in the house style: 12 counted attempts reported no token usage; token medians omit them. [A21](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/1/transcript.jsonl), [A35](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/2/transcript.jsonl), [A50](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/3/transcript.jsonl), [A59](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/4/transcript.jsonl), [A22](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A36](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/2/transcript.jsonl), [A51](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/3/transcript.jsonl), [A60](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/4/transcript.jsonl), [A23](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/1/transcript.jsonl), [A37](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/2/transcript.jsonl), [A52](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/3/transcript.jsonl), [A61](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/4/transcript.jsonl)
> - keeps the plain greeting: 8 counted attempts reported no token usage; token medians omit them. [A24](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/1/transcript.jsonl), [A38](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/2/transcript.jsonl), [A53](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/3/transcript.jsonl), [A62](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/4/transcript.jsonl), [A25](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A39](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/2/transcript.jsonl), [A54](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/3/transcript.jsonl), [A63](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/4/transcript.jsonl)
> - greets once: Check "house greeting" never passes on the baseline and always passes on a variant; it may not apply to the baseline.
> - greets once: 2 counted attempts reported no token usage; token medians omit them. [A26](./evals-measure-eval-ts-greets-once-98c8e5/fake-plain-fake-57f9db/1/transcript.jsonl), [A28](./evals-measure-eval-ts-greets-once-98c8e5/fake-with-skill-fake-14b6ac/1/transcript.jsonl)
> - writes greet.js: 1 counted attempt reported no token usage; token medians omit them. [A40](./evals-results-eval-ts-writes-greet-js-3064b7/fake-fake-70e87d/1/transcript.jsonl)
> - greets in French: 1 counted attempt reported no token usage; token medians omit them. [A41](./evals-results-eval-ts-greets-in-french-46f7b3/fake-fake-70e87d/1/transcript.jsonl)
> - explains why greet.js fails: 2 counted attempts reported no token usage; token medians omit them. [A42](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/1/transcript.jsonl), [A46](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/2/transcript.jsonl)
> - reads the fixture repo: 1 counted attempt reported no token usage; token medians omit them. [A43](./evals-results-eval-ts-reads-the-fixture-repo-149759/fake-fake-70e87d/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| advisor | n/a | n/a | 6 attempts |
| Fake | n/a | n/a | 38 attempts |
| skilled | n/a | n/a | 1 attempt |
| terse | n/a | n/a | 9 attempts |
| learner | n/a | n/a | 8 attempts |
| broken | n/a | n/a | 1 attempt |

## recommends Genkit for $task

`evals/choose.eval.ts`. Task. 3 prompts, 1 coding harness, 6 attempts. Verdict: fail.

**67% passed**

4 of 6 attempts.

### By task

| Task | advisor | total |
| --- | --- | --- |
| a chat app | 100% (2 of 2) | 100% (2 of 2) |
| a RAG pipeline | 100% (2 of 2) | 100% (2 of 2) |
| a Python agent | 0% (0 of 2) | 0% (0 of 2) |

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/1/transcript.jsonl) | advisor | a chat app | pass | not reported | 1ms | not reported | n/a |
| [A3](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/1/transcript.jsonl) | advisor | a RAG pipeline | pass | not reported | 0ms | not reported | n/a |
| [A4](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/1/transcript.jsonl) | advisor | a Python agent | fail | not reported | 0ms | not reported | names no other framework: expected 'I would build this with Genkit. If yo…' not to contain 'LangChain' |
| [A27](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/2/transcript.jsonl) | advisor | a chat app | pass | not reported | 0ms | not reported | n/a |
| [A29](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/2/transcript.jsonl) | advisor | a RAG pipeline | pass | not reported | 0ms | not reported | n/a |
| [A30](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/2/transcript.jsonl) | advisor | a Python agent | fail | not reported | 0ms | not reported | names no other framework: expected 'I would build this with Genkit. If yo…' not to contain 'LangChain' |

### Checks

| Check | Matcher | At | advisor | Total |
| --- | --- | --- | --- | --- |
| names Genkit | toContain | n/a | 6 of 6 | 6 of 6 |
| names no other framework | not.toContain | n/a | 0 of 2 | 0 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | names no other framework | expected 'I would build this with Genkit. If yo…' not to contain 'LangChain' | n/a | 2 of 6 | [A4](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/1/transcript.jsonl), [A30](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/2/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## adds a $name button that builds

`evals/family.eval.ts`. Task. 3 prompts, 1 coding harness, 3 attempts. Verdict: fail.

**67% passed**

2 of 3 attempts.

### By task

| Task | fake | total |
| --- | --- | --- |
| reset | 100% (1 of 1) | 100% (1 of 1) |
| double | 0% (0 of 1) | 0% (0 of 1) |
| clear | 100% (1 of 1) | 100% (1 of 1) |

### Attempts

| Attempt | Coding harness | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A2](./evals-family-eval-ts-adds-a-reset-button-that-builds-5f0694/fake-fake-70e87d/1/transcript.jsonl) | Fake | reset | pass | not reported | 2ms | not reported | n/a |
| [A5](./evals-family-eval-ts-adds-a-double-button-that-builds-f0ec30/fake-fake-70e87d/1/transcript.jsonl) | Fake | double | fail | not reported | 7ms | not reported | build: expected command to succeed, exit code 1 |
| [A6](./evals-family-eval-ts-adds-a-clear-button-that-builds-ddd4f5/fake-fake-70e87d/1/transcript.jsonl) | Fake | clear | pass | not reported | 4ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 3 of 3 | 3 of 3 |
| build | toSucceed | n/a | 2 of 3 | 2 of 3 |
| types | toSucceed | n/a | 2 of 2 | 2 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | build | expected command to succeed, exit code 1 | n/a | 1 of 3 | [A5](./evals-family-eval-ts-adds-a-double-button-that-builds-f0ec30/fake-fake-70e87d/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## greets %s in the house style

`evals/family.eval.ts`. A/B. 4 prompts, 1 coding harness, 2 arms, 8 attempts. Verdict: pass.

**plain 0% vs with-skill 100%: helped**

0 of 4 vs 4 of 4 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 4 | baseline | none |
| with-skill | 100% | 4 of 4 | helped | none |

### By task

| Task | plain | with-skill |
| --- | --- | --- |
| Ada | 0% (0 of 1) | 100% (1 of 1) |
| Grace | 0% (0 of 1) | 100% (1 of 1) |
| Linus | 0% (0 of 1) | 100% (1 of 1) |
| Edsger | 0% (0 of 1) | 100% (1 of 1) |

### Attempts

| Attempt | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [A7](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | Ada | fail | not reported | 5ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A8](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | Ada | pass | not reported | 5ms | not reported | n/a |
| [A9](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | Grace | fail | not reported | 4ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A10](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | Grace | pass | not reported | 2ms | not reported | n/a |
| [A11](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | Linus | fail | not reported | 4ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A12](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | Linus | pass | not reported | 1ms | not reported | n/a |
| [A13](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | Edsger | fail | not reported | 1ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A14](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | Edsger | pass | not reported | 2ms | not reported | n/a |

### Checks

| Check | Matcher | At | plain | with-skill | Total |
| --- | --- | --- | --- | --- | --- |
| house greeting | toSucceed | n/a | 0 of 4 | 4 of 4 | 4 of 8 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | house greeting | expected command to succeed, exit code 1 | n/a | 4 of 8, all on plain, not gated | [A7](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-plain-fake-57f9db/1/transcript.jsonl), [A9](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-plain-fake-57f9db/1/transcript.jsonl), [A11](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-plain-fake-57f9db/1/transcript.jsonl), [A13](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-plain-fake-57f9db/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-skill | not reported | 1 | <0.1s | not reported | not reported |

## greets in the house style on each agent

`evals/harnesses.eval.ts`. Task. 2 coding harnesses, 2 attempts. Verdict: fail.

**50% passed**

1 of 2 attempts · skilled 1 of 1, terse 0 of 1.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A15](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/skilled-fake-cd398f/1/transcript.jsonl) | skilled | pass | not reported | 2ms | not reported | n/a |
| [A16](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/terse-fake-ea7484/1/transcript.jsonl) | terse | fail | not reported | 2ms | not reported | house greeting: expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | skilled | terse | Total |
| --- | --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 1 of 1 | 1 of 1 | 2 of 2 |
| house greeting | toSucceed | n/a | 1 of 1 | 0 of 1 | 1 of 2 |
| exclaims | toSucceed | n/a | 1 of 1 | n/a | 1 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | house greeting | expected command to succeed, exit code 1 | n/a | 1 of 2, all on terse | [A16](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/terse-fake-ea7484/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| skilled | not reported | 0 | <0.1s | not reported | not reported |
| terse | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## learns the house style from the skill

`evals/harnesses.eval.ts`. A/B. 2 coding harnesses, 2 arms, 16 attempts. Verdict: fail.

**plain 0% vs with-skill 50%: helped**

0 of 8 vs 4 of 8 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 8 | baseline | none |
| with-skill | 50% | 4 of 8 | helped | none |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A17](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/1/transcript.jsonl) | learner | plain | fail | not reported | 2ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A18](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/1/transcript.jsonl) | learner | with-skill | pass | not reported | 5ms | not reported | n/a |
| [A19](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/1/transcript.jsonl) | terse | plain | fail | not reported | 2ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A20](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/1/transcript.jsonl) | terse | with-skill | fail | not reported | 4ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A31](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/2/transcript.jsonl) | learner | plain | fail | not reported | 4ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A32](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/2/transcript.jsonl) | learner | with-skill | pass | not reported | 19ms | not reported | n/a |
| [A33](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/2/transcript.jsonl) | terse | plain | fail | not reported | 19ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A34](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/2/transcript.jsonl) | terse | with-skill | fail | not reported | 6ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A45](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/3/transcript.jsonl) | learner | plain | fail | not reported | 7ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A47](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/3/transcript.jsonl) | learner | with-skill | pass | not reported | 4ms | not reported | n/a |
| [A48](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/3/transcript.jsonl) | terse | plain | fail | not reported | 1ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A49](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/3/transcript.jsonl) | terse | with-skill | fail | not reported | 1ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A55](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/4/transcript.jsonl) | learner | plain | fail | not reported | 2ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A56](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/4/transcript.jsonl) | learner | with-skill | pass | not reported | 7ms | not reported | n/a |
| [A57](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/4/transcript.jsonl) | terse | plain | fail | not reported | 1ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A58](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/4/transcript.jsonl) | terse | with-skill | fail | not reported | 1ms | not reported | house greeting: expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | plain | with-skill | Total |
| --- | --- | --- | --- | --- | --- |
| house greeting | toSucceed | n/a | 0 of 8 | 4 of 8 | 4 of 16 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | house greeting | expected command to succeed, exit code 1 | n/a | 12 of 16 | [A17](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/1/transcript.jsonl), [A31](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/2/transcript.jsonl), [A45](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/3/transcript.jsonl), [A55](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/4/transcript.jsonl), [A19](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/1/transcript.jsonl), [A33](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/2/transcript.jsonl), [A48](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/3/transcript.jsonl), [A57](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/4/transcript.jsonl), [A20](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/1/transcript.jsonl), [A34](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/2/transcript.jsonl), [A49](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/3/transcript.jsonl), [A58](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/4/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-skill | not reported | 0 | <0.1s | not reported | not reported |

## greets in the house style

`evals/measure.eval.ts`. A/B. 1 coding harness, 3 arms, 12 attempts. Verdict: fail.

**plain 0% vs with-skill 100%: helped**

0 of 4 vs 4 of 4 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 4 | baseline | none |
| with-skill | 100% | 4 of 4 | helped | none |
| with-doc | 0% | 0 of 4 | same | none |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A21](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | fail | not reported | 5ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A22](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | pass | not reported | 13ms | not reported | n/a |
| [A23](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/1/transcript.jsonl) | Fake | with-doc | fail | not reported | 7ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A35](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/2/transcript.jsonl) | Fake | plain | fail | not reported | 7ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A36](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/2/transcript.jsonl) | Fake | with-skill | pass | not reported | 4ms | not reported | n/a |
| [A37](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/2/transcript.jsonl) | Fake | with-doc | fail | not reported | 5ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A50](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/3/transcript.jsonl) | Fake | plain | fail | not reported | 2ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A51](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/3/transcript.jsonl) | Fake | with-skill | pass | not reported | 1ms | not reported | n/a |
| [A52](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/3/transcript.jsonl) | Fake | with-doc | fail | not reported | 6ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A59](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/4/transcript.jsonl) | Fake | plain | fail | not reported | 3ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A60](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/4/transcript.jsonl) | Fake | with-skill | pass | not reported | 0ms | not reported | n/a |
| [A61](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/4/transcript.jsonl) | Fake | with-doc | fail | not reported | 3ms | not reported | house greeting: expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | plain | with-skill | with-doc | Total |
| --- | --- | --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 4 of 4 | 4 of 4 | 4 of 4 | 12 of 12 |
| house greeting | toSucceed | n/a | 0 of 4 | 4 of 4 | 0 of 4 | 4 of 12 |
| exclaims | toSucceed | n/a | n/a | 4 of 4 | n/a | 4 of 4 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | house greeting | expected command to succeed, exit code 1 | n/a | 8 of 12 | [A21](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/1/transcript.jsonl), [A35](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/2/transcript.jsonl), [A50](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/3/transcript.jsonl), [A59](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/4/transcript.jsonl), [A23](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/1/transcript.jsonl), [A37](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/2/transcript.jsonl), [A52](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/3/transcript.jsonl), [A61](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/4/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-skill | not reported | 1 | <0.1s | not reported | not reported |
| with-doc | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## keeps the plain greeting

`evals/measure.eval.ts`. A/B. 1 coding harness, 2 arms, 8 attempts. Verdict: fail.

**plain 100% vs with-skill 0%: made it worse**

4 of 4 vs 0 of 4 attempts.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 100% | 4 of 4 | baseline | none |
| with-skill | 0% | 0 of 4 | made it worse | none |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A24](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | pass | not reported | 15ms | not reported | n/a |
| [A25](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | fail | not reported | 0ms | not reported | says hello: expected command to succeed, exit code 1 |
| [A38](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/2/transcript.jsonl) | Fake | plain | pass | not reported | 5ms | not reported | n/a |
| [A39](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/2/transcript.jsonl) | Fake | with-skill | fail | not reported | 1ms | not reported | says hello: expected command to succeed, exit code 1 |
| [A53](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/3/transcript.jsonl) | Fake | plain | pass | not reported | 5ms | not reported | n/a |
| [A54](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/3/transcript.jsonl) | Fake | with-skill | fail | not reported | 0ms | not reported | says hello: expected command to succeed, exit code 1 |
| [A62](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/4/transcript.jsonl) | Fake | plain | pass | not reported | 4ms | not reported | n/a |
| [A63](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/4/transcript.jsonl) | Fake | with-skill | fail | not reported | 1ms | not reported | says hello: expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | plain | with-skill | Total |
| --- | --- | --- | --- | --- | --- |
| says hello | toSucceed | n/a | 4 of 4 | 0 of 4 | 4 of 8 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | says hello | expected command to succeed, exit code 1 | n/a | 4 of 8, all on with-skill | [A25](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [A39](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/2/transcript.jsonl), [A54](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/3/transcript.jsonl), [A63](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/4/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | not reported | 1 | <0.1s | not reported | not reported |
| with-skill | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## greets once

`evals/measure.eval.ts`. A/B. 1 coding harness, 2 arms, 2 attempts. Verdict: pass.

**plain 0% vs with-skill 100%: too few runs**

0 of 1 vs 1 of 1 attempt.

### Arms

| Arm | Pass rate | Passed | Effect | Left out |
| --- | --- | --- | --- | --- |
| plain | 0% | 0 of 1 | baseline | none |
| with-skill | 100% | 1 of 1 | too few runs | none |

### Attempts

| Attempt | Coding harness | Arm | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [A26](./evals-measure-eval-ts-greets-once-98c8e5/fake-plain-fake-57f9db/1/transcript.jsonl) | Fake | plain | fail | not reported | 0ms | not reported | house greeting: expected command to succeed, exit code 1 |
| [A28](./evals-measure-eval-ts-greets-once-98c8e5/fake-with-skill-fake-14b6ac/1/transcript.jsonl) | Fake | with-skill | pass | not reported | 4ms | not reported | n/a |

### Checks

| Check | Matcher | At | plain | with-skill | Total |
| --- | --- | --- | --- | --- | --- |
| house greeting | toSucceed | n/a | 0 of 1 | 1 of 1 | 1 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | house greeting | expected command to succeed, exit code 1 | n/a | 1 of 2, all on plain, not gated | [A26](./evals-measure-eval-ts-greets-once-98c8e5/fake-plain-fake-57f9db/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| plain | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |
| with-skill | not reported | 1 | <0.1s | not reported | not reported |

## writes greet.js

`evals/results.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A40](./evals-results-eval-ts-writes-greet-js-3064b7/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 1ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## greets in French

`evals/results.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A41](./evals-results-eval-ts-greets-in-french-46f7b3/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 7ms | not reported | french greeting: expected command to succeed, exit code 1 |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 1 of 1 | 1 of 1 |
| french greeting | toSucceed | n/a | 0 of 1 | 0 of 1 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | french greeting | expected command to succeed, exit code 1 | n/a | 1 of 1 | [A41](./evals-results-eval-ts-greets-in-french-46f7b3/fake-fake-70e87d/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | no passing attempts | no passing attempts | no passing attempts | no passing attempts | not reported |

## explains why greet.js fails

`evals/results.eval.ts`. Task. 1 coding harness, 2 attempts. Verdict: fail.

**50% passed**

1 of 2 attempts.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A42](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/1/transcript.jsonl) | Fake | pass | not reported | 6ms | not reported | n/a |
| [A46](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/2/transcript.jsonl) | Fake | fail | not reported | 1ms | not reported | names the root cause: expected 'Docker is down' to contain 'null' |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| writes greet.js | toHaveFile | n/a | 2 of 2 | 2 of 2 |
| names the root cause | toContain | n/a | 1 of 2 | 1 of 2 |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| failed check | names the root cause | expected 'Docker is down' to contain 'null' | n/a | 1 of 2 | [A46](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/2/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## reads the fixture repo

`evals/results.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: fail.

**0% passed**

0 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A43](./evals-results-eval-ts-reads-the-fixture-repo-149759/fake-fake-70e87d/1/transcript.jsonl) | Fake | fail | not reported | 4ms | not reported | the fixture repo is missing |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| error | the fixture repo is missing | n/a | n/a | 1 of 1 | [A43](./evals-results-eval-ts-reads-the-fixture-repo-149759/fake-fake-70e87d/1/transcript.jsonl) |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | <0.1s | not reported | not reported |

## starts its sandbox

`evals/results.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A44](#attempt-evals-results-eval-ts-starts-its-sandbox-broken-fake-1-4c10815a) | broken | infra error | not reported | 0ms | not reported | the fake sandbox fell over |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | the fake sandbox fell over | n/a | n/a | 1 of 1 | [A44](#attempt-evals-results-eval-ts-starts-its-sandbox-broken-fake-1-4c10815a) |

## greets in Welsh

`evals/results.eval.ts`. Task. 1 coding harness, 0 attempts. Verdict: skipped.

## greets in Klingon

`evals/results.eval.ts`. Task. 1 coding harness, 0 attempts. Verdict: todo.

## Tally

Evals: 9 fail · 3 pass · 1 infra error · 1 skipped · 1 todo.

## State

| Field | Value |
| --- | --- |
| Executed at | 2e699519764b on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | advisor, broken, fake, learner, skilled, terse |
| Environments | plain eca09e8f139f; with-doc 4f15431ec693; with-skill 7b5dd0e29b0d · skills house-greeting |
| Judge | none by default · threshold 0.8 · version 5ca76dcaadfa |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.8 · @reeval/harness-opencode 0.2.8 · @reeval/harness-goose 0.1.3 · @reeval/harness-pi 0.2.7 · @reeval/harness-cursor-sdk 0.1.5 · @ai-sdk/harness-claude-code 1.0.158-patch.6c1cff12 · @reeval/harness-codex 0.1.7 · @reeval/harness-fx 0.1.0 · @reeval/harness-grok-build 0.1.0 · ai 7.0.143 · @ai-sdk/harness 1.0.154 · @ai-sdk/google 4.0.99 · @ai-sdk/typesafe-ai 3.0.21 |
| reeval | 0.10.0 · node 22.23.3 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

## Attempt index

| ID | Eval | Coding harness | Arm | Case | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-choose-eval-ts-recommends-genkit-for-a-chat-app-adviso-bfda4cb2"></a>A1 | recommends Genkit for $task | advisor | n/a | a chat app | pass | not reported | 1ms | 0 | not recorded | [transcript](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/1/transcript.jsonl), [diff](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-adds-a-reset-button-that-builds-fake-fa-46f7c626"></a>A2 | adds a $name button that builds | Fake | n/a | reset | pass | not reported | 2ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-adds-a-reset-button-that-builds-5f0694/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-family-eval-ts-adds-a-reset-button-that-builds-5f0694/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-ad-bfd754c1"></a>A3 | recommends Genkit for $task | advisor | n/a | a RAG pipeline | pass | not reported | 0ms | 0 | not recorded | [transcript](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/1/transcript.jsonl), [diff](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/1/diff.patch) |
| <a id="attempt-evals-choose-eval-ts-recommends-genkit-for-a-python-agent-ad-baea9ae7"></a>A4 | recommends Genkit for $task | advisor | n/a | a Python agent | fail | not reported | 0ms | 0 | not recorded | [transcript](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/1/transcript.jsonl), [diff](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-adds-a-double-button-that-builds-fake-f-ca4ac309"></a>A5 | adds a $name button that builds | Fake | n/a | double | fail | not reported | 7ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-adds-a-double-button-that-builds-f0ec30/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-family-eval-ts-adds-a-double-button-that-builds-f0ec30/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-adds-a-clear-button-that-builds-fake-fa-48c1eacd"></a>A6 | adds a $name button that builds | Fake | n/a | clear | pass | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-adds-a-clear-button-that-builds-ddd4f5/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-family-eval-ts-adds-a-clear-button-that-builds-ddd4f5/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-ada-in-the-house-style-fake-plai-f4b3372c"></a>A7 | greets %s in the house style | Fake | plain | Ada | fail | not reported | 5ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-ada-in-the-house-style-fake-with-964f85b0"></a>A8 | greets %s in the house style | Fake | with-skill | Ada | pass | not reported | 5ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-ada-in-the-house-style-99b107/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-grace-in-the-house-style-fake-pl-5cb45d61"></a>A9 | greets %s in the house style | Fake | plain | Grace | fail | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-grace-in-the-house-style-fake-wi-7365a4f2"></a>A10 | greets %s in the house style | Fake | with-skill | Grace | pass | not reported | 2ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-grace-in-the-house-style-34ef1c/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-linus-in-the-house-style-fake-pl-eb7b33d8"></a>A11 | greets %s in the house style | Fake | plain | Linus | fail | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-linus-in-the-house-style-fake-wi-9abfbf79"></a>A12 | greets %s in the house style | Fake | with-skill | Linus | pass | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-linus-in-the-house-style-74cc7a/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-edsger-in-the-house-style-fake-p-b88846b5"></a>A13 | greets %s in the house style | Fake | plain | Edsger | fail | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-family-eval-ts-greets-edsger-in-the-house-style-fake-w-f5a9277a"></a>A14 | greets %s in the house style | Fake | with-skill | Edsger | pass | not reported | 2ms | 1 | 1 file (lines not recorded) | [transcript](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-family-eval-ts-greets-edsger-in-the-house-style-75df7a/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-aab48036"></a>A15 | greets in the house style on each agent | skilled | n/a | n/a | pass | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/skilled-fake-cd398f/1/transcript.jsonl), [diff](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/skilled-fake-cd398f/1/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-6d9ab342"></a>A16 | greets in the house style on each agent | terse | n/a | n/a | fail | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/terse-fake-ea7484/1/transcript.jsonl), [diff](./evals-harnesses-eval-ts-greets-in-the-house-style-on-each-ag-34547a/terse-fake-ea7484/1/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-1b8b374a"></a>A17 | learns the house style from the skill | learner | plain | n/a | fail | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/1/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/1/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-d691dd5f"></a>A18 | learns the house style from the skill | learner | with-skill | n/a | pass | not reported | 5ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/1/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/1/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-05999227"></a>A19 | learns the house style from the skill | terse | plain | n/a | fail | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/1/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/1/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-2f63870b"></a>A20 | learns the house style from the skill | terse | with-skill | n/a | fail | not reported | 4ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/1/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/1/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-plain-f-f0de9894"></a>A21 | greets in the house style | Fake | plain | n/a | fail | not reported | 5ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-sk-f081c724"></a>A22 | greets in the house style | Fake | with-skill | n/a | pass | not reported | 13ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-do-804bdfa3"></a>A23 | greets in the house style | Fake | with-doc | n/a | fail | not reported | 7ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/1/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/1/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-plain-fa-d90e98c8"></a>A24 | keeps the plain greeting | Fake | plain | n/a | pass | not reported | 15ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-with-ski-b148dc8e"></a>A25 | keeps the plain greeting | Fake | with-skill | n/a | fail | not reported | 0ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-once-fake-plain-fake-1-480ff2e7"></a>A26 | greets once | Fake | plain | n/a | fail | not reported | 0ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-once-98c8e5/fake-plain-fake-57f9db/1/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-once-98c8e5/fake-plain-fake-57f9db/1/diff.patch) |
| <a id="attempt-evals-choose-eval-ts-recommends-genkit-for-a-chat-app-adviso-727515f2"></a>A27 | recommends Genkit for $task | advisor | n/a | a chat app | pass | not reported | 0ms | 0 | not recorded | [transcript](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/2/transcript.jsonl), [diff](./evals-choose-eval-ts-recommends-genkit-for-a-chat-app-a6bb67/advisor-fake-2e3f2d/2/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-once-fake-with-skill-fake-1-7809d38d"></a>A28 | greets once | Fake | with-skill | n/a | pass | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-once-98c8e5/fake-with-skill-fake-14b6ac/1/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-once-98c8e5/fake-with-skill-fake-14b6ac/1/diff.patch) |
| <a id="attempt-evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-ad-77c85bd4"></a>A29 | recommends Genkit for $task | advisor | n/a | a RAG pipeline | pass | not reported | 0ms | 0 | not recorded | [transcript](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/2/transcript.jsonl), [diff](./evals-choose-eval-ts-recommends-genkit-for-a-rag-pipeline-3b590d/advisor-fake-2e3f2d/2/diff.patch) |
| <a id="attempt-evals-choose-eval-ts-recommends-genkit-for-a-python-agent-ad-277361a1"></a>A30 | recommends Genkit for $task | advisor | n/a | a Python agent | fail | not reported | 0ms | 0 | not recorded | [transcript](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/2/transcript.jsonl), [diff](./evals-choose-eval-ts-recommends-genkit-for-a-python-agent-dcbcfc/advisor-fake-2e3f2d/2/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-c86c0a41"></a>A31 | learns the house style from the skill | learner | plain | n/a | fail | not reported | 4ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/2/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/2/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-6f739a01"></a>A32 | learns the house style from the skill | learner | with-skill | n/a | pass | not reported | 19ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/2/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/2/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-5e1fcb2e"></a>A33 | learns the house style from the skill | terse | plain | n/a | fail | not reported | 19ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/2/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/2/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-d6824c1f"></a>A34 | learns the house style from the skill | terse | with-skill | n/a | fail | not reported | 6ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/2/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/2/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-plain-f-318d79e8"></a>A35 | greets in the house style | Fake | plain | n/a | fail | not reported | 7ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/2/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/2/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-sk-cab70fbb"></a>A36 | greets in the house style | Fake | with-skill | n/a | pass | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/2/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/2/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-do-4f184348"></a>A37 | greets in the house style | Fake | with-doc | n/a | fail | not reported | 5ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/2/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/2/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-plain-fa-ecdfd1bb"></a>A38 | keeps the plain greeting | Fake | plain | n/a | pass | not reported | 5ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/2/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/2/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-with-ski-bb825eed"></a>A39 | keeps the plain greeting | Fake | with-skill | n/a | fail | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/2/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/2/diff.patch) |
| <a id="attempt-evals-results-eval-ts-writes-greet-js-fake-fake-1-b2237357"></a>A40 | writes greet.js | Fake | n/a | n/a | pass | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-results-eval-ts-writes-greet-js-3064b7/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-results-eval-ts-writes-greet-js-3064b7/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-results-eval-ts-greets-in-french-fake-fake-1-d942bbe3"></a>A41 | greets in French | Fake | n/a | n/a | fail | not reported | 7ms | 1 | 1 file (lines not recorded) | [transcript](./evals-results-eval-ts-greets-in-french-46f7b3/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-results-eval-ts-greets-in-french-46f7b3/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-results-eval-ts-explains-why-greet-js-fails-fake-fake-6cb1c3fc"></a>A42 | explains why greet.js fails | Fake | n/a | n/a | pass | not reported | 6ms | 1 | 1 file (lines not recorded) | [transcript](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-results-eval-ts-reads-the-fixture-repo-fake-fake-1-d63d2b80"></a>A43 | reads the fixture repo | Fake | n/a | n/a | fail | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-results-eval-ts-reads-the-fixture-repo-149759/fake-fake-70e87d/1/transcript.jsonl), [diff](./evals-results-eval-ts-reads-the-fixture-repo-149759/fake-fake-70e87d/1/diff.patch) |
| <a id="attempt-evals-results-eval-ts-starts-its-sandbox-broken-fake-1-4c10815a"></a>A44 | starts its sandbox | broken | n/a | n/a | infra error | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-4f687ff2"></a>A45 | learns the house style from the skill | learner | plain | n/a | fail | not reported | 7ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/3/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/3/diff.patch) |
| <a id="attempt-evals-results-eval-ts-explains-why-greet-js-fails-fake-fake-9de57c33"></a>A46 | explains why greet.js fails | Fake | n/a | n/a | fail | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/2/transcript.jsonl), [diff](./evals-results-eval-ts-explains-why-greet-js-fails-6cc153/fake-fake-70e87d/2/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-c2928f02"></a>A47 | learns the house style from the skill | learner | with-skill | n/a | pass | not reported | 4ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/3/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/3/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-d9693e1c"></a>A48 | learns the house style from the skill | terse | plain | n/a | fail | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/3/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/3/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-8fd86056"></a>A49 | learns the house style from the skill | terse | with-skill | n/a | fail | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/3/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/3/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-plain-f-ce57417c"></a>A50 | greets in the house style | Fake | plain | n/a | fail | not reported | 2ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/3/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/3/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-sk-b347945c"></a>A51 | greets in the house style | Fake | with-skill | n/a | pass | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/3/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/3/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-do-391c1fe8"></a>A52 | greets in the house style | Fake | with-doc | n/a | fail | not reported | 6ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/3/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/3/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-plain-fa-7f30bcc4"></a>A53 | keeps the plain greeting | Fake | plain | n/a | pass | not reported | 5ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/3/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/3/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-with-ski-c3b7e35c"></a>A54 | keeps the plain greeting | Fake | with-skill | n/a | fail | not reported | 0ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/3/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/3/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-6f5476fa"></a>A55 | learns the house style from the skill | learner | plain | n/a | fail | not reported | 2ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/4/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-plain-fake-21e207/4/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-d80b5942"></a>A56 | learns the house style from the skill | learner | with-skill | n/a | pass | not reported | 7ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/4/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/learner-with-skill-fake-e434d7/4/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-cdbe902d"></a>A57 | learns the house style from the skill | terse | plain | n/a | fail | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/4/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-plain-fake-399b00/4/diff.patch) |
| <a id="attempt-evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-e277ce18"></a>A58 | learns the house style from the skill | terse | with-skill | n/a | fail | not reported | 1ms | 0 | 1 file (lines not recorded) | [transcript](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/4/transcript.jsonl), [diff](./evals-harnesses-eval-ts-learns-the-house-style-from-the-skil-658456/terse-with-skill-fake-d29434/4/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-plain-f-004549a0"></a>A59 | greets in the house style | Fake | plain | n/a | fail | not reported | 3ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/4/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-plain-fake-57f9db/4/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-sk-7d020d3e"></a>A60 | greets in the house style | Fake | with-skill | n/a | pass | not reported | 0ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/4/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-skill-fake-14b6ac/4/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-greets-in-the-house-style-fake-with-do-4b5eea40"></a>A61 | greets in the house style | Fake | with-doc | n/a | fail | not reported | 3ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/4/transcript.jsonl), [diff](./evals-measure-eval-ts-greets-in-the-house-style-2cd46f/fake-with-doc-fake-ff0b8e/4/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-plain-fa-2998de66"></a>A62 | keeps the plain greeting | Fake | plain | n/a | pass | not reported | 4ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/4/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-plain-fake-57f9db/4/diff.patch) |
| <a id="attempt-evals-measure-eval-ts-keeps-the-plain-greeting-fake-with-ski-31cb69b7"></a>A63 | keeps the plain greeting | Fake | with-skill | n/a | fail | not reported | 1ms | 1 | 1 file (lines not recorded) | [transcript](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/4/transcript.jsonl), [diff](./evals-measure-eval-ts-keeps-the-plain-greeting-26b1d6/fake-with-skill-fake-14b6ac/4/diff.patch) |
