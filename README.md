```
                                    ██
 ▄▄ ▄▄▄  ▄▄▄▄   ▄▄▄▄  ▄▄  ▄▄  ▄▄▄▄  ██
 ███▀▀▀ ██▄▄██ ██▄▄██ ██  ██  ▄▄▄██ ██
 ██     ██   ▄ ██   ▄  ████  ██  ██ ██
 ██      ▀▀▀▀   ▀▀▀▀    ▀▀    ▀▀▀▀▀ ▀▀

 Evaluation harness for SDKs, CLIs, MCP servers, skills, and docs.

 # Get started using the `/setup` skill:
 npx skills add reeval-ai/reeval --skill setup

 # Or install manually:
 npm i -D reeval && npx reeval init
```

> [!IMPORTANT]  
> **Work in Progress**: reeval is under active development. Expect breaking changes between minor version releases.

<p align="center">
  <a href="https://www.npmjs.com/package/reeval"><img src="https://img.shields.io/npm/v/reeval.svg" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/reeval.svg" alt="license"></a>
  <a href="https://docs.reeval.ai"><img src="https://img.shields.io/badge/docs-docs.reeval.ai-63D0BD" alt="docs"></a>
  <a href="https://x.com/reeval_ai"><img src="https://img.shields.io/badge/follow-%40reeval__ai-000000?logo=x&logoColor=white" alt="follow on X"></a>
</p>

**reeval** is an open-source TypeScript evaluation harness. It gives a real coding agent a task in a fresh sandbox, then grades the final state with deterministic graders and, where code can't decide, a model grader. Run the same task with and without a skill, doc, or MCP server, and reeval reports whether the change helped.

Each task is a `*.eval.ts` file in `evals/`, next to the tool it tests. Each run writes a JSON record, and recorded runs commit to Git, so `reeval compare` can diff a pull request's run against the last recorded one and fail the job when a task regresses.

## Features

Cursor ⋅ Claude Code ⋅ Codex ⋅ Antigravity ⋅ OpenCode ⋅ Goose ⋅ pi ⋅ fx ⋅ Grok Build

- **Real agents**: each agent harness runs the coding agent itself, with its own tools, skills, and rules, as it works on a developer's machine ([Choose an agent](docs/configuration/agents/index.mdx)).
- **Reliability across trials**: each task runs several trials per agent. `capability()` asks whether the agent can pass at all (pass@k), and `regression()` asks whether it passes every time (pass^k) ([Statistics](docs/reference/statistics.mdx)).
- **Grading and trajectories**: deterministic graders check the final state, and a model grader judges only what code can't decide. Each trial keeps its trajectory, and `reeval regrade` grades recorded trials again without another agent run ([Assertions](docs/evaluations/grading/assertions.mdx)).
- **Variant comparisons**: one task runs a baseline and its variants with the same prompt and graders, then prints whether each variant helped, made it worse, or did the same ([Measure lift against a baseline](docs/results/compare/lift.mdx)).
- **Regression gates in CI**: `reeval compare --fail-on-regression` diffs a run against its nearest recorded ancestor and fails the job when a task regresses ([Compare past runs](docs/results/compare/past-runs.mdx)).
- **Keys stay on the host**: each trial starts in a fresh sandbox that holds only a placeholder key. reeval's egress gateway swaps in the real key on requests to that provider and nowhere else ([Pass secrets](docs/configuration/environments/secrets.mdx)).
- **Pinned environments**: an environment starts from a workspace, such as a git repository at a fixed ref, then adds files, setup steps, rules, skills, and MCP servers, so every trial starts from the same state ([Define an environment](docs/configuration/environments/index.mdx)).
- **History in Git**: recorded runs sit beside the code. `reeval query` reads them with SQL, and `reeval studio` shows each trial's trajectory, diff, and graders ([Record runs in Git](docs/evaluations/runs/recording.mdx)).

## Install

```bash
npm i -D reeval
```

reeval runs on Node.js 22.16 or later. Real runs also need a sandbox runtime (Docker or Podman) and API keys for the agents. `npx reeval doctor` checks both and names the fix for anything missing.

## Quickstart

Initialize a suite in your repo, run your first trials, and inspect the results in Studio:

```bash
npx reeval init
npx reeval run
npx reeval studio
```

If you want your coding agent to write the first task for you, paste this into your session:

```text
Add a reeval evaluation suite to this repository:
1. Run `npx reeval init` to scaffold the config and eval directory.
2. Create an environment in `evals/environments.ts` pointing to our starter app or minimal fixture.
3. Write one task in `evals/` that tests a core user workflow end to end using our SDK/CLI/API, with a deterministic grader (`succeeded(...)`) and a binary `judge(...)` check.
4. Run `npx reeval run` and summarize the baseline pass rate and any failure patterns.
```

A coding agent can also follow the [setup skill](skills/setup/SKILL.md).

To check the plan without starting a sandbox or spending tokens, run `npx reeval run --dry-run`:

```text
REEVAL v0.31.0  dry run

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

### Or set up by hand

This example uses Docker for its sandbox. The [Quickstart](docs/getting-started/quickstart.mdx) lists every requirement and explains each step.

```bash
npm install -D reeval
npx reeval init --agent claude-code
```

Add the keys to `.env.local`, next to `reeval.config.ts`. The Google key is optional: it's for `reeval analyze`, and a run without it still runs the task:

```bash title=".env.local"
ANTHROPIC_API_KEY=replace-with-anthropic-key
GOOGLE_GENERATIVE_AI_API_KEY=replace-with-google-key
```

Build the image the harness runs in, then check Node, Docker, the image, and the keys:

```bash
npx reeval image build
npx reeval doctor
```

## Measure whether a skill helps

The Quickstart writes a page with no styling, then runs it with and without Anthropic's `brand-guidelines` skill. The baseline, `page`, has no skill. The variant, `brand-guidelines`, adds the one from `anthropics/skills`. Both arms get the same prompt and graders, four trials each.

```ts title="evals/environments.ts"
import { defineEnvironment } from 'reeval'

export const page = defineEnvironment('page', ({ directory }) => ({
  files: directory('./project'),
}))

export const withSkill = page.extendEnvironment(
  'brand-guidelines',
  ({ skill }) => ({
    skills: [
      skill.git('github:anthropics/skills', {
        ref: 'dbd4588f9e1033efb41dad4bef2f7947c8993d44',
        path: 'skills',
        only: ['brand-guidelines'],
      }),
    ],
  }),
)
```

```ts title="evals/brand.eval.ts"
import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { page, withSkill } from './environments.ts'

export default defineEval({
  compare: { control: page, variants: [withSkill] },
  runs: 4,
  graders: [
    hasFile('index.html', /href="styles\.css"/, {
      name: 'links-styles-css',
    }),
    hasFile('styles.css', /#d97757/i, { name: 'brand-orange' }),
    hasFile('styles.css', /Poppins[\s\S]*Lora|Lora[\s\S]*Poppins/, {
      name: 'brand-fonts',
    }),
  ],
  task: async (c) => {
    await c.send(
      "Give index.html Anthropic's look: write styles.css with Anthropic's " +
        'brand colors and fonts, and link it from index.html.',
    )
  },
})
```

Run it with `npx reeval run brand`. The [Quickstart](docs/getting-started/quickstart.mdx) shows the result block it prints. `helped` means the variant passed more often than the baseline, and `made it worse` less often.

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

- Explore [`examples/`](examples) for 88 runnable projects. Most run on a fake agent with no keys or Docker.
- Explore [recipes](docs/recipes) for step-by-step guides to common jobs. Most build on one of the examples:
  - [Measure a skill](docs/recipes/measure-a-skill.mdx)
  - [Measure your docs](docs/recipes/measure-your-docs.mdx)
  - [Measure MCP servers](docs/recipes/measure-mcp-servers.mdx)
  - [Test an SDK](docs/recipes/test-an-sdk.mdx)
  - [Test a CLI](docs/recipes/test-a-cli.mdx)
  - [Test recommendations](docs/recipes/test-recommendations.mdx)
  - [Judge an app](docs/recipes/judge-an-app.mdx)
  - [Compare harnesses](docs/recipes/compare-harnesses.mdx)
  - [Gate pull requests](docs/recipes/gate-pull-requests.mdx)
  - [Track past runs](docs/recipes/track-past-runs.mdx)

## Documentation

Read the [docs](https://docs.reeval.ai) to learn more about writing tasks and graders, choosing agents, environments, and sandboxes, running in CI, and reading results and trajectories.

## License

[Apache-2.0](LICENSE). Copyright 2026 Invertase Limited. The npm package ships third-party licenses and attributions in `THIRD_PARTY_NOTICES.md`. Questions about licensing: [oss@invertase.io](mailto:oss@invertase.io).
