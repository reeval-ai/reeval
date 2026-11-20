# Run 20261028T223022Z_nogit_cursor-agent_ss88

3 of 3 counted attempts passed. 4s wall time. Tokens: not reported. Cost: not reported.

Run `20261028T223022Z_nogit_cursor-agent_ss88` by cursor-agent, 2026-10-28, reeval 0.15.1, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - captures a page that renders: 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/transcript.jsonl)
> - captures a page that throws: 1 counted attempt reported no token usage; token medians omit them. [A2](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/transcript.jsonl)
> - captures a missing page: 1 counted attempt reported no token usage; token medians omit them. [A3](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 3 attempts |

## captures a page that renders

`evals/pages.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBeGreaterThan 0 | toBeGreaterThan | evals/pages.eval.ts:39 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

### Captures

| Capture | Coding harness | Arm | Case | Status | Attempt |
| --- | --- | --- | --- | --- | --- |
| [sign-up](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/artifacts/sign-up.png) | Fake | site | n/a | HTTP n/a, n/a | [A1](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/transcript.jsonl) |

## captures a page that throws

`evals/pages.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A2](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBeGreaterThan 0 | toBeGreaterThan | evals/pages.eval.ts:46 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

### Captures

| Capture | Coding harness | Arm | Case | Status | Attempt |
| --- | --- | --- | --- | --- | --- |
| [blank](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/artifacts/blank.png) | Fake | site | n/a | HTTP n/a, n/a | [A2](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/transcript.jsonl) |

## captures a missing page

`evals/pages.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A3](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/transcript.jsonl) | Fake | pass | not reported | 0ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBeGreaterThan 0 | toBeGreaterThan | evals/pages.eval.ts:53 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 0 | <0.1s | not reported | not reported |

### Captures

| Capture | Coding harness | Arm | Case | Status | Attempt |
| --- | --- | --- | --- | --- | --- |
| [login](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/artifacts/login.png) | Fake | site | n/a | HTTP n/a, n/a | [A3](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/transcript.jsonl) |

## Tally

Evals: 3 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.6 · id 56a1506c02b1 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | fake |
| Environments | site 36d87a613ef6 |
| Judge | none by default · threshold 0.8 · version 717433497d3f |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.12 · @reeval/harness-opencode 0.2.10 · @reeval/harness-goose 0.1.6 · @reeval/harness-pi 0.2.8 · @reeval/harness-cursor-sdk 0.1.6 · @ai-sdk/harness-claude-code 1.0.160-patch.b17cde50 · @reeval/harness-codex 0.1.9 · @reeval/harness-fx 0.1.3 · @reeval/harness-grok-build 0.1.6 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/anthropic 4.0.83 · @ai-sdk/google 4.0.100 · @ai-sdk/openai 4.0.97 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.15.1 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Image reeval-sandbox:cursor-0.1.6 isn't pushed, so an exact rerun needs this machine's image (id 56a1506c02b1).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-pages-eval-ts-captures-a-page-that-renders-fake-site-d-4aa173b8"></a>A1 | captures a page that renders | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/transcript.jsonl), [diff](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/diff.patch), [sign-up](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/artifacts/sign-up.png), [snapshot](./evals-pages-eval-ts-captures-a-page-that-renders-96d33f/fake-site-docker-a17d85/1/snapshots/final) |
| <a id="attempt-evals-pages-eval-ts-captures-a-page-that-throws-fake-site-do-30b11fae"></a>A2 | captures a page that throws | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/transcript.jsonl), [diff](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/diff.patch), [blank](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/artifacts/blank.png), [snapshot](./evals-pages-eval-ts-captures-a-page-that-throws-01af2a/fake-site-docker-a17d85/1/snapshots/final) |
| <a id="attempt-evals-pages-eval-ts-captures-a-missing-page-fake-site-docker-7ce50706"></a>A3 | captures a missing page | Fake | pass | not reported | 0ms | 0 | not recorded | [transcript](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/transcript.jsonl), [diff](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/diff.patch), [login](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/artifacts/login.png), [snapshot](./evals-pages-eval-ts-captures-a-missing-page-a7187c/fake-site-docker-a17d85/1/snapshots/final) |
