# sends the key off its host

1 of 1 counted attempt passed. 4s wall time. Tokens: not reported. Cost: not reported. 0bbae45.

Run `20261109T203553Z_0bbae45_cursor-agent_z4pz` by cursor-agent, 2026-11-09, reeval 0.23.0, 1 run per cell.

> [!WARNING]
> Read these before the results.
>
> - 1 counted attempt reported no token usage; token medians omit them. [A1](./evals-sends-eval-ts-sends-the-key-off-its-host-7fc63b/fake-keys-docker-a10e17/1/transcript.jsonl)

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 1 attempt |

`evals/sends.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: pass.

**100% passed**

1 of 1 attempt.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](./evals-sends-eval-ts-sends-the-key-off-its-host-7fc63b/fake-keys-docker-a10e17/1/transcript.jsonl) | Fake | pass | not reported | 119ms | not reported | n/a |

### Checks

| Check | Matcher | At | Fake | Total |
| --- | --- | --- | --- | --- |
| toBe true | toBe | evals/sends.eval.ts:5 | 1 of 1 | 1 of 1 |

### Effort

| Group | Median tokens | Median tool calls | Median agent time | Median cost | Cost per pass |
| --- | --- | --- | --- | --- | --- |
| all attempts | not reported | 1 | 0.1s | not reported | not reported |

## Tally

Evals: 1 pass.

## State

| Field | Value |
| --- | --- |
| Executed at | 0bbae4503f73 on master, clean (the commit that adds this record is later) |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.9 · id 89e5dcb843c3 · no registry digest (built locally) · CLI @cursor/sdk 1.0.40 |
| Harnesses | fake |
| Resources | docker 2 vCPU 4.0 GiB: 1 attempt · CPU 0.1 s (avg 0.24, peak 0.24 cores) · memory peak 22 MiB |
| Environments | keys c69a1959a772 · secrets API_KEY |
| Judge | none by default · threshold 0.8 · version ad7a34e4636f |
| Packages | @vitest/expect 5.0.5 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.16 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.16 · @reeval/harness-pi 0.2.9 · @reeval/harness-cursor-sdk 0.1.9 · @ai-sdk/harness-claude-code 1.0.176-patch.a9d56a8c · @reeval/harness-codex 0.1.13 · @reeval/harness-fx 0.1.11 · @reeval/harness-grok-build 0.1.12 · ai 7.0.161 · @ai-sdk/harness 1.0.172 · @ai-sdk/anthropic 4.0.95 · @ai-sdk/google 4.0.110 · @ai-sdk/openai 4.0.107 · @ai-sdk/typesafe-ai 3.0.32 |
| reeval | 0.23.0 · node 22.23.4 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Image reeval-sandbox:cursor-0.1.9 isn't pushed, so an exact rerun needs this machine's image (id 89e5dcb843c3).

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-sends-eval-ts-sends-the-key-off-its-host-fake-keys-doc-e840a9ae"></a>A1 | sends the key off its host | Fake | pass | not reported | 119ms | 1 | not recorded | [transcript](./evals-sends-eval-ts-sends-the-key-off-its-host-7fc63b/fake-keys-docker-a10e17/1/transcript.jsonl), [diff](./evals-sends-eval-ts-sends-the-key-off-its-host-7fc63b/fake-keys-docker-a10e17/1/diff.patch), [snapshot](./evals-sends-eval-ts-sends-the-key-off-its-host-7fc63b/fake-keys-docker-a10e17/1/snapshots/final) |
