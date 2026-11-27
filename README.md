```
                                    ██
 ▄▄ ▄▄▄  ▄▄▄▄   ▄▄▄▄  ▄▄  ▄▄  ▄▄▄▄  ██
 ███▀▀▀ ██▄▄██ ██▄▄██ ██  ██  ▄▄▄██ ██
 ██     ██   ▄ ██   ▄  ████  ██  ██ ██
 ██      ▀▀▀▀   ▀▀▀▀    ▀▀    ▀▀▀▀▀ ▀▀

 Evaluation runner for SDKs, CLIs, MCP servers, and docs.

 # Get started using the `/setup` skill:
 npx skills add reeval-ai/reeval --skill setup

 # Or install manually:
 npm i -D reeval && npx reeval init
```

> [!IMPORTANT]
> **Work in Progress**: reeval is under active development. Expect breaking changes between minor version releases.

# reeval

reeval is an open-source evaluation runner for developer tools. It gives a real coding agent a task in a fresh sandbox, then checks the result with assertions on files, commands, and the trajectory, and with an LLM judge where an assertion can't decide. Run the same task with and without a skill, doc, or MCP server, and reeval reports whether the change helped.

Each task is a `*.eval.ts` file in `evals/`, next to the tool it tests. Each run writes a JSON record, and recorded runs commit to Git, so `reeval compare` can diff a pull request's run against the last recorded one and fail the job when a task regresses.

## Features

Cursor ⋅ Claude Code ⋅ Codex ⋅ Antigravity ⋅ OpenCode ⋅ Goose ⋅ pi ⋅ fx ⋅ Grok Build

- **Real agents**: each harness runs the agent itself, with its own tools, skills, and rules, as it works on a developer's machine ([Choose an agent](docs/configuration/agents/index.mdx)).
- **Keys stay on the host**: each attempt starts in a fresh sandbox that holds only a placeholder key. reeval's egress gateway swaps in the real key on requests to that provider and nowhere else ([Pass secrets](docs/configuration/environments/secrets.mdx)).
- **Compare a change**: one eval runs a baseline and its variants with the same prompt and checks, then prints whether each variant helped, made it worse, or did the same ([Measure lift against a baseline](docs/results/compare/lift.mdx)).
- **Pinned environments**: an environment starts from a workspace, such as a git repository at a fixed ref, then adds files, setup steps, rules, skills, and MCP servers, so every attempt starts from the same state ([Define an environment](docs/configuration/environments/index.mdx)).
- **History in Git**: recorded runs sit beside the code. `reeval query` reads them with SQL, and `reeval studio` shows each attempt's trajectory, diff, and checks ([Record runs in Git](docs/evaluations/runs/recording.mdx)).

## Install

```bash
npm i -D reeval
```

reeval runs on Node.js 22.16 or later. Real runs also need a sandbox runtime (Docker or Podman) and an API keys for the agents. `npx reeval doctor` checks both and names the fix for anything missing.

## Quickstart

Scaffold a config and one eval, then check that reeval loads them:

```bash
npx reeval init --yes     # reeval.config.ts on Cursor, and evals/greet.eval.ts
npx reeval run --dry-run  # smoke check: plans the run, no keys or sandbox
```

```text
REEVAL v0.16.1  dry run

  ➜  Run:       …
  ➜  Agent:     cursor:composer-2.5 (effort: not checked)
  ➜  Sandbox:   docker
  ➜  Scope:     1 eval file · 1 eval · 1 cell · 1 attempt
  ➜  Est. Time: ~3m 00s (serial)

eval   agents  variants  runs  attempts  target         notes
greet  1       —         1     1         capability(1)  effort: cursor:composer-2.5 not checked …
  grader 1/2  has-file:greet.js · built-in · weight 1
  grader 2/2  succeeded:greets Ada · built-in · weight 1
…
```

Then build the agent's sandbox image, add its key, and run it for real:

```bash
npx reeval image build
echo 'CURSOR_API_KEY=…' >> .env.local
npx reeval run
```

Without `--yes`, `init` asks which agent to configure. The starter eval only proves the setup works; the next section is what reeval is for.

## Measure whether a skill helps

The Vercel AI SDK deprecates `generateObject` in favor of `Output.object`, and agents trained on older code still reach for the old call. This eval measures whether a skill shipped with the SDK fixes that. It runs the same task in two arms, four attempts each: `plain` has no skill, and `with-skill` adds the one in `skills/ai-sdk`.

```ts
// evals/ai-sdk.eval.ts
import { defineEnvironment, defineEval } from 'reeval';
import { hasFile } from 'reeval/graders';

const plain = defineEnvironment('plain', {});

const withSkill = plain.extendEnvironment('with-skill', ({ skill }) => ({
  skills: [skill.local('../skills/ai-sdk')],
}));

export default defineEval({
  runs: 4,
  compare: { control: plain, variants: [withSkill] },
  graders: [
    hasFile('triage.ts', { name: 'writes triage.ts' }),
    hasFile('triage.ts', /Output\.object/, { name: 'uses Output.object' }),
  ],
  task: async (c) => {
    await c.send(`
      Add triage.ts: triageIssue(title, body) uses the ai package to
      return a typed { labels, priority, duplicateOf }.
    `);
  },
});
```

```text
$ npx reeval run evals/ai-sdk.eval.ts
…
$ npx reeval show
…
pass             triages a GitHub issue with the AI SDK
  arm                 pass
  plain               0 of 4
  with-skill          4 of 4  helped
  check               plain   with-skill
  uses Output.object  0 of 4  4 of 4
  +1 more passed
…
1 pass
```

Without the skill, no attempt used `Output.object`; with it, all four did. `helped` means the variant passed more often than the baseline, and `made it worse` less often. When the 95% interval of the difference spans zero (`-v` prints it), the `too-few-tries` remark names the `runs` that would make it hold. `+1 more passed` folds the checks that every arm passed.

## Run in CI and inspect runs

| Command                               | Use it for                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `reeval run --profile pr`             | A run sized for a pull request. In the config `init` writes, that is one run per cell, no variants, and a budget of 20 trials. |
| `reeval compare --fail-on-regression` | Diff a run against its nearest recorded ancestor, and exit 1 when a task regressed.                                            |
| `reeval show --md`                    | One run's results as Markdown, for a job summary or a PR comment.                                                              |
| `reeval query`                        | Read-only SQL over every run, or built-in views such as `lift`, `effort`, and `failing_attempts`.                              |
| `reeval studio`                       | Runs, trajectories, diffs, and graders in the browser.                                                                         |

Environments load extensions from where teams already keep them:

- **Skills**: from a local folder, a git repository at a pinned ref, an npm package, the skills.sh registry, or written inline.
- **MCP servers**: stdio, Streamable HTTP, or SSE servers, with their own environment variables and headers.
- **Rules**: the project's instructions, written as `AGENTS.md`, or `CLAUDE.md` on Claude Code, before the first turn.

## Examples

The recipes in [`docs/evaluations/recipes`](docs/evaluations/recipes) are complete evals for common jobs:

- [Measure a skill](docs/evaluations/recipes/measure-a-skill.mdx): with and without a skill, gated on a minimum lift.
- [Compare harnesses](docs/evaluations/recipes/compare-harnesses.mdx): one suite on several agents at once, with pass rate and effort per agent.
- [Measure MCP servers](docs/evaluations/recipes/measure-mcp-servers.mdx): check the agent calls the server's tools, and whether answers improve.
- [Check a recommendation](docs/evaluations/recipes/test-recommendations.mdx): ask which library to use, and let a judge decide whether the agent picks the right one.
- [Fail a pull request](docs/evaluations/recipes/gate-pull-requests.mdx): run on every pull request and fail the check on a regression.

The [`examples/`](examples) directory has 80 runnable projects, one idea each, from [`with-checks`](examples/with-checks) (deterministic checks) and [`with-skill-lift`](examples/with-skill-lift) (does a skill help?) to sandboxes, egress, judges, captures and real-world tasks. Most run on a fake agent with no keys or Docker; [`examples/README.md`](examples/README.md) lists them all.

## Documentation

The manual in [`docs/`](docs/overview.mdx) covers harnesses, sandboxes, environments, secrets and egress, checks and judges, profiles, history, and every CLI command and flag.

## For coding agents

To write or update evals, load [`skills/reeval/SKILL.md`](skills/reeval/SKILL.md). For every command, flag, and exit code, run `npx reeval --help`.

To preview a run without starting sandboxes or spending tokens, run `npx reeval run --dry-run --json`. It prints the planned evals, cells, and attempts as one JSON document and exits 0.

To check a machine's setup, run `npx reeval doctor --json`. It checks Node.js, the sandbox and its images, and the agents' keys, never prints a key, and changes nothing.

To read past runs without calling a model, run `npx reeval query failing_attempts --json`, or `npx reeval analyze --context` for a run's digest. `npx reeval mcp` serves the run history over stdio as read-only MCP tools.

## License

[Apache-2.0](LICENSE). Copyright 2026 Invertase Limited. The npm package ships third-party licenses and attributions in `THIRD_PARTY_NOTICES.md`. Questions about licensing: [oss@invertase.io](mailto:oss@invertase.io).
