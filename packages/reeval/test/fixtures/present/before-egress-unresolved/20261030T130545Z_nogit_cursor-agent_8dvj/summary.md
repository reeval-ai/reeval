# probes metadata

1 of 1 counted attempt passed. 3s wall time. Tokens: not reported. Cost: not reported.

Run `20261030T130545Z_nogit_cursor-agent_8dvj` by cursor-agent, 2026-10-30, reeval 0.17.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-metadata-eval-ts-probes-metadata-c447b4/fake-proxied-docker-e69ee5/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 1 attempt |

`evals/metadata.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-metadata-eval-ts-probes-metadata-c447b4/fake-proxied-docker-e69ee5/1/transcript.jsonl) | Fake | pass | not reported | 164ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBeGreaterThan 0 | toBeGreaterThan | evals/metadata.eval.ts:9 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 2 | 0.2s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.6 · id 695c22f8098c · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | fake |
| Environments | proxied eca09e8f139f |
| Judge | none by default · threshold 0.8 · version b7a490837586 |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.12 · @reeval/harness-opencode 0.2.11 · @reeval/harness-goose 0.1.7 · @reeval/harness-pi 0.2.8 · @reeval/harness-cursor-sdk 0.1.6 · @ai-sdk/harness-claude-code 1.0.160-patch.b17cde50 · @reeval/harness-codex 0.1.9 · @reeval/harness-fx 0.1.3 · @reeval/harness-grok-build 0.1.6 · ai 7.0.145 · @ai-sdk/harness 1.0.156 · @ai-sdk/anthropic 4.0.83 · @ai-sdk/google 4.0.100 · @ai-sdk/openai 4.0.97 · @ai-sdk/typesafe-ai 3.0.22 |
| reeval | 0.17.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Image reeval-sandbox:cursor-0.1.6 isn't pushed, so an exact rerun needs this machine's image (id 695c22f8098c).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-metadata-eval-ts-probes-metadata-fake-proxied-docker-1-ab67ed1c"></a>A1 | probes metadata | Fake | pass | not reported | 164ms | 2 | not recorded | [transcript](./evals-metadata-eval-ts-probes-metadata-c447b4/fake-proxied-docker-e69ee5/1/transcript.jsonl), [diff](./evals-metadata-eval-ts-probes-metadata-c447b4/fake-proxied-docker-e69ee5/1/diff.patch) |
