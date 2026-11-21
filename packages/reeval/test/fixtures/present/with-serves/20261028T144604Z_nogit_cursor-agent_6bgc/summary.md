# Run 20261028T144604Z_nogit_cursor-agent_6bgc

2 of 2 counted attempts passed. 2s wall time. Tokens: not reported. Cost: not reported.

Run `20261028T144604Z_nogit_cursor-agent_6bgc` by cursor-agent, 2026-10-28, reeval 0.15.1, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - serves on PORT: 1 counted attempt reported no token usage; token medians omit them. [A1](#attempt-evals-serve-eval-ts-serves-on-port-fake-servers-fake-1-5b0c665e)
> - serves on its own port: 1 counted attempt reported no token usage; token medians omit them. [A2](#attempt-evals-serve-eval-ts-serves-on-its-own-port-fake-servers-fake-9458a5c2)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 2 attempts |

## serves on PORT

`evals/serve.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](#attempt-evals-serve-eval-ts-serves-on-port-fake-servers-fake-1-5b0c665e) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe port | toBe | n/a | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## serves on its own port

`evals/serve.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A2](#attempt-evals-serve-eval-ts-serves-on-its-own-port-fake-servers-fake-9458a5c2) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe own | toBe | n/a | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

## Tally

Evals: 2 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | none (fake sandbox) |
| Harnesses | fake |
| Environments | servers 1ef26df59216 |
| Judge | none by default · threshold 0.8 · version 717433497d3f |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.12 · @reeval/harness-opencode 0.2.10 · @reeval/harness-goose 0.1.6 · @reeval/harness-pi 0.2.8 · @reeval/harness-cursor-sdk 0.1.6 · @ai-sdk/harness-claude-code 1.0.160-patch.b17cde50 · @reeval/harness-codex 0.1.9 · @reeval/harness-fx 0.1.3 · @reeval/harness-grok-build 0.1.6 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/anthropic 4.0.83 · @ai-sdk/google 4.0.100 · @ai-sdk/openai 4.0.97 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.15.1 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-serve-eval-ts-serves-on-port-fake-servers-fake-1-5b0c665e"></a>A1 | serves on PORT | Fake | pass | not reported | 0ms | 0 | not recorded | n/a |
| <a id="attempt-evals-serve-eval-ts-serves-on-its-own-port-fake-servers-fake-9458a5c2"></a>A2 | serves on its own port | Fake | pass | not reported | 0ms | 0 | not recorded | n/a |
