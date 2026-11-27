---
name: reeval
description: >
  How to write, run and debug evals with reeval, the eval runner for coding agents (npm package
  reeval; CLI `reeval`, alias `re`). Use whenever a task mentions reeval, reeval.config.ts,
  *.eval.ts files, `reeval run`, evals for a coding agent, comparing skills, MCP servers or
  docs, or lift. Not for changing reeval's own source: contributors follow the repository's
  AGENTS.md.
---

# reeval

This skill is for writing evals with reeval, not for changing reeval itself: to contribute to
the reeval-ai/reeval repository, follow its root `AGENTS.md` instead.

reeval runs a real coding agent (Cursor, Claude Code, Antigravity, OpenCode, Goose, pi,
Codex, fx or Grok Build) on a task in a fresh Docker sandbox, then grades the result with
deterministic graders and an LLM judge. You write evals in TypeScript; `reeval run` runs them.

The package and CLI are `reeval`. Full docs: the `docs/` folder of github.com/reeval-ai/reeval (a docs.page
site; its Reference tab has every option, flag and error).

This file covers the common work: set up a project, write an eval with graders and a judge,
compare a skill, fix a config, read a failure. Read a reference file when the task needs it:

| Read | When the task involves |
|---|---|
| [references/config.md](references/config.md) | Harness factories and their keys, `effort`, judge models, `reeval.yaml`, path rules, where the sandbox comes from, imports, the options cascade |
| [references/evals.md](references/evals.md) | `cases` and `where`, `target`, `toStayWithin`, `c.serve`, `c.writeFile` hidden tests, the judge's inputs, the judge's input size, judge errors, every matcher |
| [references/capture.md](references/capture.md) | Web UIs: `c.capture()` screenshots, `instructions` journeys, `artifacts` on judges and questions |
| [references/compare.md](references/compare.md) | `compare` beyond the example below: the baseline, gates, lift and effort, labeled checks, `questions`, `skill_files` |
| [references/environments.md](references/environments.md) | Environments: skills, files, rules, MCP servers, `git()` workspaces, `directory()`, Docker sandboxes, secrets, egress |
| [references/cli.md](references/cli.md) | The CLI beyond `run`: `query` views, `explain`, `show`, `compare`, `record`, `studio`, `mcp`, filters, exit codes |
| [references/mistakes.md](references/mistakes.md) | An error message from reeval you need to map to its fix (the full table) |
| [../eval-rubric/SKILL.md](../eval-rubric/SKILL.md) | A `Worth knowing:` list after a run, or reviewing an eval's name, prompts and judge questions: one section per remark kind, with its fix |

Use reeval's terms in code and messages: eval (`defineEval`), trial (one run of a cell;
`trials: n`), harness (`cursor()`, …), cell (harness × environment × sandbox), baseline and variant,
lift (variant mean score − baseline mean score, 95% interval), target, graders and judge, trajectory, effort
(measured tool calls, agent time, tokens). Not "attempt" or "control/treatment";
[references/vocabulary.md](references/vocabulary.md) maps other frameworks' words to these.

## Workflow

Setting reeval up for someone (new to reeval, or "set up reeval here")? Follow the setup
skill, [../setup/SKILL.md](../setup/SKILL.md), first: it asks what to evaluate and
writes the first evals. This section is the reference it builds on.

```bash
npm i -D reeval
npx reeval init --agent cursor   # or --bare: the config, no example eval
npx reeval run --dry-run           # the plan, no keys or Docker
npx reeval image build             # once, for real agents
npx reeval doctor                  # Docker, keys and images, with fixes
npx reeval run
```

1. Install: `npm init -y` if there's no `package.json`, then `npm i -D reeval`
   (or a tarball: `npm i -D /path/to/reeval.tgz`). Pre-release: pin the version.
   Node 22.16 or later; npm, pnpm or Yarn.
2. `npx reeval init --agent <cursor|claude-code|antigravity|opencode|goose|pi|codex|fx|grok-build>`
   (it only asks in a terminal) writes `reeval.config.ts` (the agent, `analysis.model:
   'google/gemini-3.8-flash'` for `reeval explain`, and `pr` and `nightly` profiles), `evals/environments.ts` (one `defineEnvironment`), `evals/greet.eval.ts` (an eval
   in that environment), the `.gitignore` entries (`.reeval/`, `.env*`), an `eval` script and a
   `tsconfig.json` that allows the evals' `.ts` imports, then says whether Docker is running.
   `--bare` writes only the config, `.gitignore` and `package.json`. Where a config exists it
   exits 2 before asking; `--force` replaces only `reeval.config.ts`. Otherwise it only adds:
   it merges into `package.json` and `.gitignore` and skips any other file that exists. Or write
   `reeval.config.ts` and `evals/**/*.eval.ts` (the default `include`) yourself.
3. `npx reeval run --dry-run` prints the plan (evals, cells, trials, time and a cost range)
   without running anything and needs no credentials or Docker. `--dry-run --json` for a program
   to read.
4. For real agents, and before any `tart()` run (a run never pulls its macOS image; `tart()`
   runs every real harness, and the build bakes each one's CLI into a copy of the image):
   `npx reeval image build` once (and after upgrading reeval), keys in
   `.env.local` next to `reeval.config.ts` (not the directory you run from), `npx reeval doctor`
   (exit 1 names each problem and its fix; a missing `analysis.model` or its key,
   `GOOGLE_GENERATIVE_AI_API_KEY`, is only a warning; `--json`, `--online` tries the keys), then
   `npx reeval run`. Exit 0 means no eval missed a blocking target. `npx reeval run --json` prints the
   results as one JSON document on stdout (each check `ran` or `not run`, each variant's
   `effect`), with the progress on stderr.
5. Read failures in the summary, then `.reeval/runs/<run>/summary.md` and each trial's directory
   (`trajectory.jsonl`, `diff.patch`, `checks/<n>.log`, `judge-input.json`, `setup.log`).
   `npx reeval run -v` prints a timestamped trace per trial; `.reeval/debug/` keeps it.
   Each trial's whole final workspace is in its directory there, under `snapshots/final/`, to
   read or run what the agent built.
   `npx reeval query "SELECT … FROM failing_trials"` names each failed trial's first failed
   check (more views in [references/cli.md](references/cli.md)).

Always rerun `--dry-run` after editing: config mistakes are exit-2 usage errors with a precise
message, one at a time.

## reeval.config.ts

```ts
import { defineConfig } from 'reeval'
import { cursor } from 'reeval/agent'

export default defineConfig({
  include: ['evals/**/*.eval.ts'],            // default
  agents: cursor({ model: 'composer-2.5' }), // model required; CURSOR_API_KEY
  // no default judge model; pin versions
  judge: { model: 'typesafe-ai/jev-1.14.0', threshold: 0.8 },
  // trials per cell; unset, 1, or 4 for a compare with variants
  timeout: '15m',                             // per trial
})
```

- Harnesses (`reeval/agent`), each with a required `model`; a list runs each as its own cell:
  `cursor` (`CURSOR_API_KEY`), `claudeCode` (`ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`), `antigravity`
  (`GEMINI_API_KEY`), `opencode` (the provider's key; model `<provider>/<model>`), `goose` and
  `pi` (the provider's key; model `<provider>/<model>`, e.g. `google/gemini-3.8-flash` on `GOOGLE_GENERATIVE_AI_API_KEY`), `codex` (`OPENAI_API_KEY`), `fx` (`OPENAI_API_KEY` for a bare id,
  `AI_GATEWAY_API_KEY` with `vercel()` or `OPENROUTER_API_KEY` with `openrouter()` in `gateway`), `grokBuild` (`XAI_API_KEY`), `fakeAgent`. Details
  and `effort` in [references/config.md](references/config.md).
- Judge models: `'typesafe-ai/jev-1.14.0'` (`TYPESAFE_AI_API_KEY`, recommended),
  `'google/gemini-3.8-flash'` (`GOOGLE_GENERATIVE_AI_API_KEY`), `anthropic/*` (`ANTHROPIC_API_KEY`)
  and `'openai/gpt-6-luna'` (`OPENAI_API_KEY`; OpenAI's Decisions API takes only its decision
  model, so not `openai/gpt-5.5`), each on its provider's own key. reeval uses no gateway by
  default: `AI_GATEWAY_API_KEY` is read only with `gateway: [vercel()]` in the config (or a judge
  `gateway: 'vercel'` pin, listed there), `OPENROUTER_API_KEY` only with `openrouter()`. As a
  judge, `vercel()` serves decision models only (Jev, `openai/gpt-6-luna-decisions`), and
  `openrouter()` only those on its Decisions API (`typesafe/jev-1.14`), never a language model:
  pin a language-model judge to `gateway: 'direct'`. Always a provider prefix. Every `gateway`
  list ends with `direct()`, so a cell no listed gateway serves falls back to its own key (the
  plan's hint says so); `direct({ enabled: false })` refuses it instead.
- Imports: `reeval` (`defineConfig`, `defineEnvironment`, `defineEval`, `defineGrader`, `EvalError`,
  `regression`, `capability`, `DEFAULT_EGRESS_ALLOW`, `DEFAULT_SKILL_EXCLUDE`, types), `/agent`, `/graders`
  (the built-in graders and `judge`), `/sandbox`
  (`docker`, `fakeSandbox`), `/judge` (`fakeJudge`, `RECOMMENDED_JUDGE_MODEL`). There is no `test`, `describe`, `baseline`, `secret` or `skill` export.
- `defineConfig` and each eval's `defineEval` take the same options (`agents`, `sandbox`,
  `environment`, `env`, `judge`, `trials`, `target`, `timeout`, `tags`, …); profile `defaults` apply
  first unless the eval sets `pin`. Options are plain objects, never functions. Unknown
  keys are errors with a hint (`repeat` → "Did you mean trials?"), and type errors in a
  `defineConfig` object.
- `trials: { bestOf: 5 }` (odd, 3 or more) stops each cell once trials that reach the target's
  threshold, or those that don't, have a majority (3 to 5 trials) and gates on it. Use it to settle a flaky pass/fail for less than a
  fixed count; not on an eval with `compare` (refused: lift needs equal trials), and a cell
  only reaches `flaky_cells`' 6-trial `flaky` in one run from `bestOf: 7`.
- An eval's fingerprint reads its own body, options, case and `revision`, not
  helpers, constants outside the body or fixtures. After changing one of those in a way that
  changes what the eval measures, bump `revision` (`{ revision: 2 }` on the eval)
  so `reeval compare` says `can't compare … revision 1 → 2` instead of `regressed`.

### Without Docker or API keys: the fake trio

```ts
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  // A scripted "agent": writes these files every turn and replies with text.
  agents: fakeAgent({
    files: { 'hello.txt': 'hello\n' },
    text: 'Created hello.txt.',
  }),
  sandbox: fakeSandbox(), // default machine; not an environment
  judge: { model: fakeJudge({ score: 0.9 }) }, // fixed score, no model call
})
```

`fakeAgent` also takes `withSkill: { files, text }` (used when the environment gives the agent
a skill), `script` (one list of `{ exec }`, `{ write }`, `{ reply }`, `{ mcp: 'server/tool' }`
steps per turn), `layout` (an agent's id, such as `'claude-code'`), `failWith`, `delayMs`,
`turnMs` (each turn's agent time, exactly: effort comparisons without scheduling jitter),
`flakeRate`, `reasoning`, `tools` and `id`.

`fakeSandbox()` is for testing configs and reeval itself without Docker. It runs commands on
your host with your tools, brokers no secrets and enforces no egress, so an eval passing there says nothing about its checks in the eval's real sandbox.
Don't use it to validate an eval, and don't put it on an environment that real harnesses use:
real Cursor runs need Docker.

## Evals

```ts
// evals/hello.eval.ts
import { defineEval } from 'reeval'
import { hasFile, judge, succeeded } from 'reeval/graders'

export default defineEval({
  graders: [
    hasFile('hello.txt', /hello/),
    succeeded('grep -q hello hello.txt'),
    judge('Does hello.txt contain the right content?', {
      inputs: { contents: ['hello.txt'] },
    }),
  ],
  task: async (c) => {
    await c.send('Create hello.txt containing "hello".')
    await c.exec('grep -q hello hello.txt')
  },
})
```

- One `*.eval.ts` file is one eval: `export default defineEval({ …options, task })`. `skip: true`
  or `skip: 'reason'` skips it (no `.only` or `.todo` in TypeScript). `{ cases: [...] }` runs one
  eval over a list, with `task: async (c, item) => …` (cases pool into one pass rate, see
  [references/evals.md](references/evals.md)). The default `target`, `capability()`, never fails the run: the eval
  records what agents do; `regression()` fails the run on any miss. The eval id is the file path under the eval root without `.eval.ts`; moving the
  file restarts its history. Organize paths after the question they answer
  (`recommendation/genkit`, not `genkit-test-2`), so results and `reeval explain` read clearly.
- `await c.send(prompt)` runs one agent turn and returns a `Turn` (`text`, `status`, `diff`,
  `trajectory`). Call it again for multi-turn; a judge's `inputs: { turns: 'all' }` shows every
  turn.
- `await c.exec(cmd)` returns `{ exitCode, stdout, stderr }`. A check that can fail on a
  transient (a hidden test that calls a model or a network service) gets
  `c.exec(cmd, { retries: 2 })`: any non-zero exit runs it again, and the record and output say
  `passed on try 2 of 3`. Don't roll a retry loop into the test itself.
  `c.exec(cmd, { env: { EXPECTED: '42' } })` sets variables for that command only (a hidden
  verify script's inputs), over the environment's; secret-named values are masked, and a brokered
  secret's host value goes in as its placeholder.
  `await c.readFile(path)` the text or `null` (`~/` for home). `await c.writeFile(path, text)` places a file after a turn (a hidden
  test the agent never saw). Web apps: `c.serve` and `c.capture` in
  [references/capture.md](references/capture.md).
- `judge(question, { inputs })`: the judge sees only the inputs the grader turns on, and it
  needs at least one (there are no defaults, here or in any config): `task`, `output`, `files`,
  `diff` (`true` or patterns), `contents` (files whole), `trajectory` (`true`, `'tools'`,
  `'full'`), `checks`, `observations`, `artifacts`. Pick what the question needs: code → `{ diff: ['src/**'] }`
  or `{ contents: ['README.md'] }`, the agent's answer → `{ output: true }`, how it worked →
  `{ trajectory: 'tools' }`. `turns` only selects; details in
  [references/evals.md](references/evals.md). Prefer deterministic checks for what can be checked; use the judge for quality, with plain
  yes/no questions that don't name one specific way of doing it.
- A judge grader whose provider fails after its retries, or that times out, ends the trial
  `infra_error`, which `--retry-errors` runs again; one the model refuses, or answers malformed,
  scores 0 with its `error`, and the other graders still run.
- Make the eval trustworthy. Before a real run, swap in the fake harness, and only the harness,
  so the eval runs in its real sandbox (its `docker()` image, `install`, egress and brokered
  secrets): an oracle `fakeAgent` that does the task right must pass, and a canary that cheats
  or gets it wrong must fail. A canary that passes means a check isn't checking. Put them in the
  one config as profiles that set `defaults.agents` (and `defaults.judge`), never
  `defaults.sandbox`, then `reeval image build --profile oracle` and
  `reeval run --profile oracle` / `--profile canary` (needs Docker, no keys); see
  [references/evals.md](references/evals.md#trustworthy-evals). Not `fakeSandbox()`.
  Keep grading out of the agent's reach: run hidden tests in a `defineGrader` with `env: docker()` and `data`, and guard seeded files
  with `notInDiff(['test/**'], { required: true })`.
  When the behavior is the outcome, judge the program's output, not the diff:
  `await c.exec('node app.js')` in the task and `judge(q, { inputs: { checks: ['node app.js'] } })`.
- Give the environment a `.gitignore` in `files` (the project's isn't copied in): an agent that
  runs a build otherwise fills the judge's diff with its output.
- Trajectory graders: `usedSkill(name)`, `calledMcp(server, tool)`,
  `calledTool(name | RegExp, input?)`, `ran(command?)`, `wrote(path?)`, `searched(query?)`,
  `fetched(url?)`. `wrote` counts write and edit tool calls; a shell write shows in
  `inDiff(paths)`. `ran('genkit')` matches anywhere in a command
  line (`cat genkit.config.ts` too); to ask "did it run the CLI", use
  `ran({ program: 'genkit', args: /^flow:run\b/ })`, which matches the program each segment ran
  after env assignments, `timeout`, `sudo`, `npx`, `pnpm dlx` and similar wrappers.
  `shellCommands(c)` (from `reeval`) lists those `{ program, args, line, ok, turn }` to count.
  Guard files with `notInDiff(globs)`. Gitignored files don't appear in the diff, so use
  `hasFile()` to check them. Name a grader with its `name` option:
  `hasFile('greet.js', /export/, { name: 'exports greet' })`.
- The task fails the trial when it throws: a plain `assert` or an `EvalError` ends it there.
  Thrown errors (the body's own, a dead sandbox, a timeout) end the trial.

## Environments and compare

An environment is what the agent runs *in*: skills, files, rules, MCP servers, env vars, setup
steps and the workspace's starting code. `compare` runs the same eval in a baseline and each
variant and reports lift.

```ts
import { defineEnvironment, defineEval } from 'reeval'
import { succeeded } from 'reeval/graders'

const greetsAda = `node -e "import('./greet.js').then((m) =>
  process.exit(m.greet('Ada') === 'Ahoy, Ada!' ? 0 : 1))"`
const plain = defineEnvironment('plain', {})
const houseStyle = plain.extendEnvironment('house-style', ({ skill }) => ({
  skills: [skill.local('./skills/house-greeting')], // a dir with SKILL.md, relative to this file
}))

export default defineEval({
  compare: { baseline: plain, variants: [houseStyle] },
  graders: [succeeded('greets Ada')],
  task: async (c) => {
    await c.send('Create greet.js exporting greet(name) in our house style.')
    await c.exec(greetsAda, { label: 'greets Ada' })
  },
})
```

- A spec, or a synchronous callback that destructures the helpers it needs (`skill`, `plugin`,
  `file`, `directory`, `git`, `mcp`, `secret`): `files: { 'docs/api.md': file('../docs/api.md') }`,
  `rules: file('../rules/house.md')` (AGENTS.md; CLAUDE.md for Claude Code),
  `mcp: { docs: mcp.stdio('npx', ['-y', '@acme/docs-mcp@1.0.0']) }`,
  `setup: [{ run: 'npm ci', timeout: '5m' }]`. More in
  [references/environments.md](references/environments.md).
- Trials = evals × agents × (1 baseline + variants) × trials per cell. The example is 1 eval, 2 cells
  (`<harness>/plain/<sandbox>` baseline, `<harness>/house-style/<sandbox>` variant), 8 trials:
  without `trials`, a compare runs 4 a cell, the fewest whose lift often holds (with `cases`, once a
  case: the lift pairs cases). A `trials` below 4 shows
  only the direction, with a `too-few-trials` remark; `trials: 1` at any level or a profile's `limit.trials: 1` keeps a smoke run cheap.
- Each variant runs as that environment on its own; `compare` does not layer, inherit or
  extend. Share setup with `parent.extendEnvironment(name, spec)` before `compare`. `baseline` is
  required, and `environments` beside `compare` is an error: the baseline goes in `compare`.
- Only variant cells gate; a baseline's misses don't fail the run. Below four trials a
  side each variant's effect is only a direction; from four, the block adds an effort table
  (median tools, time, tokens per environment), which often shows a skill's effect first. In a compare,
  keep independent requirements as separate graders, not an `EvalError` thrown from the task, so each gets a score.
- `questions: [{ question: 'How did the agent pick its greeting?', trajectory: true }]` beside
  `compare` asks a model about each trial as it ends (`choices: ['yes', 'no']` for a pick); an
  entry with `across: 'environment'` (and, say, `diff: true`) asks which side did better, pair by
  pair, after the run. Each entry turns on at least one input, as on `judge()`, except `contents`. Questions
  never gate and need a language model. Details, gates,
  `minLift` and `reeval query skill_files` (which skill files each trial opened) are in
  [references/compare.md](references/compare.md).

## CLI

```text
reeval run [filter...]   --dry-run [--json] --trials <n> --tag <t> --trait <k=v> --profile <p>
                         --config <path> --record --ui plain -v
reeval show [run]        reeval history         reeval compare [base] [head]
reeval query lift        reeval query effort
reeval query "SELECT … FROM failing_trials"
reeval explain           reeval studio          reeval image build      reeval doctor
```

| Exit code | Means |
|---|---|
| 0 | Pass, and `--dry-run` |
| 1 | An eval missed a blocking target |
| 2 | A usage or config error, including a filter that matches nothing |
| 3 | An infra error, such as a sandbox that failed to start, a harness key the API rejected or a turn the provider stopped |

`reeval run` ends with a status list: each eval file, a line per eval under it with its icon, the
number it's judged on and its target (`✓`/`✗` only for a target that blocks, `·` for one that
reports), and for a miss, a throw, a compare or an eval with remarks, the lines under it (a row
per run or case that cost points, with the graders and failed checks that cost it, an
`EvalError`'s reason, meta and turn, each check's message and line, a variant's effect as `helped`,
`made it worse` or `same`; for an agent, also the rest of each message, the snapshot and each
remark's whole sentence); `-v` expands every eval. Then the tally
(`Done in 12s · 3 evals · 1 on target · 1 below · 1 report only`; an `error:` outside any eval, such as a stray rejection in an eval file, is
`1 run error` and fails the run; an eval with the default `target: capability()` is `report only`, never on
target or below, so read its mean and rows for how it went). `Worth knowing:` under an eval names what about it needs work
(a flaky check, too few trials, a slow MCP server), with the line to fix, from fixed rules with no
model; they never change a verdict or the exit code, and go in `remarks.json` beside the run. The
eval rubric ([../eval-rubric/SKILL.md](../eval-rubric/SKILL.md)) explains each kind. `summary.md`
and `reeval show` print the full result blocks, a table per environment and check.

Every command uses the nearest `reeval.config.*` (or `reeval.yaml`) in the current directory or
above, or `--config <path>`. Runs land in `.reeval/runs/`. All views, `explain` and the MCP
server: [references/cli.md](references/cli.md).

## Common mistakes (and the fix)

| Mistake | Fix |
|---|---|
| `compare` in `reeval.config.ts` | Put it on the eval's `defineEval` |
| `environments: [a, b]` to measure b, or `compare: [b]` | `compare: { baseline: a, variants: [b] }` |
| `compare: { baseline: a, … }` | `compare: { baseline: a, … }` |
| `repeat: 3` / `times` | `trials: 3` |
| Judge model `'gemini-3.8-flash'` | `'google/gemini-3.8-flash'` |
| `cursor()` with `fakeSandbox()` | Use `fakeAgent()` or `docker()` |
| Test file named `*.test.ts` | `*.eval.ts` under `evals/` |

Every error message and its fix: [references/mistakes.md](references/mistakes.md).
