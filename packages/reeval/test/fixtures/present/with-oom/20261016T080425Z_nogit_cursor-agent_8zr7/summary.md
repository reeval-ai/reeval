# builds the app

0 of 0 counted attempts passed · 1 infra error. 3s wall time. Tokens: not reported. Cost: not reported.

Run `20261016T080425Z_nogit_cursor-agent_8zr7` by cursor-agent, 2026-10-16, reeval 0.8.0, 1 run per cell.

## Coding harnesses

| Coding harness | Served models | Gateway | Attempts |
| --- | --- | --- | --- |
| Fake | n/a | n/a | 1 attempt |

`evals/build.eval.ts`. Task. 1 coding harness, 1 attempt. Verdict: infra error.

### Attempts

| Attempt | Coding harness | Outcome | Tokens | Agent time | Cost | Why |
| --- | --- | --- | --- | --- | --- | --- |
| [A1](#attempt-evals-build-eval-ts-builds-the-app-fake-small-docker-1-63fd8824) | Fake | infra error | not reported | 0ms | not reported | out of memory: 1 process killed at the 128m limit; raise docker({ memory }) |

### Failures

| Kind | What | Message | At | Count | Attempts |
| --- | --- | --- | --- | --- | --- |
| infra error | out of memory: 1 process killed at the 128m limit; raise docker({ memory }) | n/a | n/a | 1 of 1 | [A1](#attempt-evals-build-eval-ts-builds-the-app-fake-small-docker-1-63fd8824) |

## Tally

Evals: 1 infra error.

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:cursor-0.1.4 · id 0fbb429cab00 · no registry digest (built locally) · CLI @cursor/sdk 1.0.37 |
| Harnesses | fake |
| Environments | small eca09e8f139f |
| Judge | none by default · threshold 0.8 · version 52dba214af1c |
| Packages | @vitest/expect 5.0.2 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.6 · @reeval/harness-opencode 0.2.7 · @reeval/harness-goose 0.1.2 · @reeval/harness-pi 0.2.6 · @reeval/harness-cursor-sdk 0.1.4 · @ai-sdk/harness-claude-code 1.0.152-patch.8edc594f · @reeval/harness-codex 0.1.6 · ai 7.0.140 · @ai-sdk/harness 1.0.148 · @ai-sdk/google 4.0.93 · @ai-sdk/typesafe-ai 3.0.18 |
| reeval | 0.8.0 · node 22.14.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |

> **Warning:** Image reeval-sandbox:cursor-0.1.4 isn't pushed, so an exact rerun needs this machine's image (id 0fbb429cab00).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Outcome | Tokens | Agent time | Tool calls | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-evals-build-eval-ts-builds-the-app-fake-small-docker-1-63fd8824"></a>A1 | builds the app | Fake | infra error | not reported | 0ms | 0 | not recorded | n/a |
