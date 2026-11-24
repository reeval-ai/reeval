# subagents

1 of 1 counted attempts passed. 21s wall time. 67k tokens (52k cache reads). agent $0.0054 (est.).

Run `20261124T104611Z_nogit_cursor-agent_c0jm` by cursor-agent, 2026-11-24, reeval 0.31.0, profile `codex`, 1 run per cell.

`spike.eval.ts`. Task. 1 coding harness, 1 attempt.

**100% passed**

1 of 1 counted attempts passed on all 2 assertions. 1 coding harness.

## Assertions

| Assertion | Matcher | codex:gpt-5.6-luna | Total |
| --- | --- | --- | --- |
| add | toHaveFile | 1 of 1 | 1 of 1 |
| mul | toHaveFile | 1 of 1 | 1 of 1 |

## By Coding harness

| Coding harness | Pass rate | Tokens | Tool calls | Turns | Cost | Agent time | Files changed | Lines added | Lines removed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| codex:gpt-5.6-luna | 100% | 67k | 4 | 1 | $0.0054 | 17s | 2 | 2 | 0 |

## State

| Field | Value |
| --- | --- |
| Executed at | not a git repository |
| Lockfiles | none found |
| Images | reeval-sandbox:codex-0.1.14 · id 725fc01634c2 · no registry digest (built locally) · CLI codex-cli 0.167.2 |
| Harnesses | codex:gpt-5.6-luna (model gpt-5.6-luna, reasoning effort medium, served gpt-5.6-luna[effort=medium], served reasoning effort medium) |
| Resources | docker 2 vCPU 4.0 GiB: 1 attempt · CPU 1.5 s (avg 0.08, peak 0.33 cores) · memory peak 118 MiB |
| Environments | puzzle f7226e524714 |
| Judge | none by default · threshold 0.8 · version 1f259248a52c |
| Packages | @vitest/expect 5.1.0 · jiti 2.7.0 · @reeval/harness-antigravity 0.1.17 · @reeval/harness-opencode 0.2.16 · @reeval/harness-goose 0.1.17 · @reeval/harness-pi 0.2.10 · @reeval/harness-cursor-sdk 0.1.9 … |
| reeval | 0.31.0 · node 26.13.0 · typescript evals · linux/x64 |
| Runner | local · cursor-agent |
| Artifacts | all |
| Record | [20261124T104611Z_nogit_cursor-agent_c0jm.json](../20261124T104611Z_nogit_cursor-agent_c0jm.json) |
| Context | 51 files |

<details><summary>All 51 context files</summary>

| Path | sha256 |
| --- | --- |
| ~/.agents/skills/.ai-sdk-harness-skills.json | 5ddf48ce4d70 |
| ~/.codex/config.toml | f677b1b9f906 |
| ~/.codex/skills/.system/.codex-system-skills.marker | f7ddaf721fc2 |
| ~/.codex/skills/.system/imagegen/LICENSE.txt | 4dd13869245e |
| ~/.codex/skills/.system/imagegen/SKILL.md | 681ddb4ad6d0 |
| ~/.codex/skills/.system/imagegen/agents/openai.yaml | 9ca574af1458 |
| ~/.codex/skills/.system/imagegen/assets/imagegen-small.svg | cff5f34f57ff |
| ~/.codex/skills/.system/imagegen/assets/imagegen.png | 95952f644064 |
| ~/.codex/skills/.system/imagegen/references/cli.md | ecfc2e09261a |
| ~/.codex/skills/.system/imagegen/references/codex-network.md | c88298ca4481 |
| ~/.codex/skills/.system/imagegen/references/image-api.md | dc975d7af8a4 |
| ~/.codex/skills/.system/imagegen/references/prompting.md | b210b051c775 |
| ~/.codex/skills/.system/imagegen/references/sample-prompts.md | 70474177d151 |
| ~/.codex/skills/.system/imagegen/scripts/image_gen.py | b4345cf835e5 |
| ~/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py | a5893c4bd04b |
| ~/.codex/skills/.system/openai-docs/LICENSE.txt | 4dd13869245e |
| ~/.codex/skills/.system/openai-docs/SKILL.md | aa6829e21df2 |
| ~/.codex/skills/.system/openai-docs/agents/openai.yaml | 44b9efac6be1 |
| ~/.codex/skills/.system/openai-docs/assets/openai-small.svg | 45be1f0757eb |
| ~/.codex/skills/.system/openai-docs/assets/openai.png | 156cc84d7332 |
| ~/.codex/skills/.system/openai-docs/references/codex-self-knowledge.md | 8c8fb00e6e5c |
| ~/.codex/skills/.system/openai-docs/references/latest-model.md | 7e5b9437c6ad |
| ~/.codex/skills/.system/openai-docs/references/mcp-diagnostics.md | 49bbd2f73df7 |
| ~/.codex/skills/.system/openai-docs/references/model-migration.md | b0c21d509bd0 |
| ~/.codex/skills/.system/openai-docs/references/model-selection.md | ba2d164abbca |
| ~/.codex/skills/.system/openai-docs/references/official-docs.md | 7962f2dce550 |
| ~/.codex/skills/.system/openai-docs/references/prompting-guide.md | 5c791edd5bfc |
| ~/.codex/skills/.system/openai-docs/references/upgrade-guide.md | 63352ece4bd1 |
| ~/.codex/skills/.system/openai-docs/references/upgrading-to-gpt-6-astra.md | cacacdfe0b51 |
| ~/.codex/skills/.system/openai-docs/scripts/fetch-codex-manual.mjs | 1ea0ca869e3f |
| ~/.codex/skills/.system/openai-docs/scripts/resolve-latest-model-info | 7354dbb030ca |
| ~/.codex/skills/.system/openai-docs/scripts/resolve-latest-model-info.cjs | 589b89515ab6 |
| ~/.codex/skills/.system/review-agent/SKILL.md | 07079efd0dc7 |
| ~/.codex/skills/.system/review-agent/agents/openai.yaml | 4d867a46d15e |
| ~/.codex/skills/.system/skill-creator/SKILL.md | 6656e5475563 |
| ~/.codex/skills/.system/skill-creator/agents/openai.yaml | d07d21b93fcf |
| ~/.codex/skills/.system/skill-creator/assets/skill-creator-small.svg | 6591bf8ea9bb |
| ~/.codex/skills/.system/skill-creator/assets/skill-creator.png | a4024b0306dd |
| ~/.codex/skills/.system/skill-creator/license.txt | cfc7749b96f6 |
| ~/.codex/skills/.system/skill-creator/references/openai_yaml.md | ffac39318e40 |
| ~/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py | 816df12072d7 |
| ~/.codex/skills/.system/skill-creator/scripts/init_skill.py | bf0656a5f9d8 |
| ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py | ee6dba90f44d |
| ~/.codex/skills/.system/skill-installer/LICENSE.txt | cfc7749b96f6 |
| ~/.codex/skills/.system/skill-installer/SKILL.md | d68b77e5bbb3 |
| ~/.codex/skills/.system/skill-installer/agents/openai.yaml | 5ce223d8b107 |
| ~/.codex/skills/.system/skill-installer/assets/skill-installer-small.svg | 3928703ff00d |
| ~/.codex/skills/.system/skill-installer/assets/skill-installer.png | d0a230b1a79b |
| ~/.codex/skills/.system/skill-installer/scripts/github_utils.py | 61c1bbe2ae21 |
| ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py | 38f311b75664 |
| ~/.codex/skills/.system/skill-installer/scripts/list-skills.py | 9d6dfb2abf3a |

</details>

> **Warning:** Image reeval-sandbox:codex-0.1.14 isn't pushed, so an exact rerun needs this machine's image (id 725fc01634c2).

> **Warning:** Not a git repository, so the code under test isn't pinned.

## Attempt index

| ID | Eval | Coding harness | Arm / Case | Outcome | Tokens | Agent time | Tools | Diff | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <a id="attempt-spike-eval-ts-subagents-codex-gpt-5-6-luna-puzzle-docker-1-db73a6bb"></a>A1 | spike.eval.ts › subagents | codex:gpt-5.6-luna | puzzle | pass | 67k | 17s | 4 | 2 files, +2 / -0 | [transcript](./spike-eval-ts-subagents-c4f85d/codex-gpt-5-6-luna-puzzle-docker-b26ab0/1/transcript.jsonl), [diff](./spike-eval-ts-subagents-c4f85d/codex-gpt-5-6-luna-puzzle-docker-b26ab0/1/diff.patch) |
