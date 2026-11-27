# Evals: the attempt API, judges and matchers

## Contents

- Cases: `cases`, `where`, and `target`
- The attempt: `c.send`, `c.exec`, `c.serve`, files
- The judge: inputs, input size, errors
- Trustworthy evals
- Matchers

## Cases: `cases`, `where`, and `target`

- ``export default defineEval({ …, task })`; `skip: true` or `skip: 'reason'` (no `.only`/`.todo` in TypeScript)
  (an error in CI), `.todo`. The eval id is the file path under the eval root without `.eval.ts`; renaming an eval restarts its history.
- `defineEval({ cases: [...], task: async (c, item) => … })` runs one eval over a list: one pass
  rate over the cases and, with `compare`, one lift paired by case, which `minLift` gates (not
  each case's). Prefer it to separate evals when the cases are one population: six cases at
  `runs: 1` can reach a lift verdict where each case alone is within noise. Fewer than six
  discordant cases shows only a direction (`insufficient` in `reeval query case_lift`), so
  aim for six cases or more; the plan hints when there are fewer. No `runs: { bestOf }` beside it.
  A failing case fails the eval, and the result prints the mean over the cases; under
  `regression()` it fails the run too. It is one eval: one row in `--dry-run` and the run output (a
  case table under it when it fails, or with `-v`), one entry in the record with its cases
  inside, counted once in the tally. The failing case still records `fail`.
- For evals that pass or fail on their own, don't use `cases`: give each item its own `*.eval.ts` file, with the item in the name.
- Each case is an object with a `key`, which names its row (`cases: [{ key: 'users', table:
  'users' }]`; `Case<T>` is `{ key: string } & T`). Keys are unique, at most 80 characters, with
  no surrounding whitespace, `#` or `›`. `cases` and `where` go on `defineEval`, not the config.
- Porting `evaluate.each`: write `defineEval({ cases: items, ...opts, task })` with the old option names made plural (`agents`, `environments`,
  `compare.control`). Give each item the `key` that `%s` or `$id` held; a changed key starts
  that case's history again.
- `where: ({ case, environment, harness }) => boolean` (TypeScript only) picks which case runs
  on which environment, at plan time, from each environment's `traits` (`defineEnvironment('next',
  { traits: { stack: 'next' } })`; never shown to the agent). Reading a trait no environment
  defines is an error; with `compare` it sees the control, and its answer holds for the variants.
  `--dry-run` notes `excluded on vite-app: q2`, the run's case table shows `–` there, and each case's record keeps its own in
  `excluded`. A cell left with no cases is an error: drop that environment instead.
- `where` says which pairs fit, the same every run; to run only some environments today, use
  `reeval run --trait stack=next` (repeat to AND) or a profile's
  `limit: { traits: { stack: ['next', 'vite'] } }`. Both narrow after `where`, by the control's
  traits under `compare`, and `--dry-run` notes `--trait stack=next leaves out vite-app`. Never
  read a flag or a variable in `where` to do this.
- `defineEval({ task })` with the default `target: capability()` records what agents do (with
  `c.observe` and checks) and fails the run only on run or infra errors. Its result prints the
  mean score, which no target gates on.
  `compare.minLift` is an error beside it. `regression(0.8)` gates
  every attempt (pass^k) and `capability(1, { blocking: true })` one attempt (pass@k); without
  `blocking`, a capability miss doesn't fail the run. A compare's target gates its variants only.
  A comment on an eval describes the current check (why a canary fails, which path it reads),
  not what used to be true or which product a prompt was ported from.

## The attempt: `c.send`, `c.exec`, `c.serve`, files

- `await c.send(prompt)` runs one agent turn and returns a `Turn` (`text`, `status`, `diff`,
  `trajectory`). Call it again for multi-turn; a judge's `inputs: { turns: 'all' }` shows every
  turn.
- `await c.exec(cmd)` returns `{ exitCode, stdout, stderr }`; `c.exec(cmd, { background: true })`
  starts it without waiting and returns `{ kill() }`. `{ env: { NAME: 'value' } }` sets variables
  for that command only, over the environment's (in the background too); a value named like a
  secret (`*_TOKEN`, `*_KEY`, …) is masked in everything reeval writes, and a brokered secret's
  host value goes in as its placeholder. `c.exec(cmd, { retries: 2, interval: 2000 })`
  runs a command that exits non-zero again, up to 2 more times 2 s apart, and resolves with the
  last try: for a check that can fail on a transient, such as a test calling a model. Any non-zero
  exit retries (reeval doesn't read the output), and a last failed try is a failed check. `await c.serve(cmd, port?)` is that plus a
  port (`PORT` / `$PORT` on a bash string), and returns once `cmd` listens, on `PORT` or the one
  port it picked itself. A `port` something already listens on (the agent's dev server) throws:
  pass none and serve on `PORT`. `c.capture()` screenshots it: see
  [capture.md](capture.md).
- `await c.readFile(path)` the text or `null` (`~/` for home). `await c.writeFile(path, text)`
  places a file after a turn (a hidden test the agent never saw) instead of seeding it in
  `files`; later turns' `diff` leaves it out but shows any change the agent makes to it, even
  under `.gitignore`. Don't place grading files with a `c.exec` heredoc: the next turn's diff
  (and the judge) would count them as the agent's. The sandbox and session start on the first
  call that needs them (`c.send`, `c.exec`, `c.readFile`, `c.writeFile`, `c.serve`,
  `c.capture`), so a check before any turn sees what the environment set up.
  `c.attempt.cell.role` is
  `'control'` or `'variant'`.
- `c.observe(name, value)` records a JSON value about the attempt (which ORM it installed, how many
  files it touched) that affects the score only through a grader that reads it; the run output tallies it per cell and
  `reeval query attempt_values` lists it. Judges and questions see it only with
  `observations: true` (or a list of names). Use it for what you want to count, and
  `observed(name, predicate)` from `reeval/graders` for what must hold.

## The judge: inputs, input size, errors

- `judge(question, { inputs })` from `reeval/graders`: the judge sees the question and only the
  inputs the grader turns on. Every input is off until `inputs` sets it, and a judge needs at
  least one (`true`, a mode or a non-empty list); there are no defaults, and the config, profile,
  group and eval `judge` take only `model`, `providerOptions`, `maxConcurrent` and `gateway`.
  With none, reeval refuses the grader before any model call.

  | Input | Shows |
  |---|---|
  | `task: true` | the graded turn's prompt |
  | `output: true` | the graded turn's final message |
  | `files: true` | `status path` lines for the changed files, under `diff`'s patterns |
  | `diff: true` / `['src/**', '!**/*.test.ts']` | the diff since the eval started (gitignore-style, last match wins) |
  | `contents: ['README.md', 'src/**']` | files whole, changed or not; they leave the diff |
  | `trajectory: true` / `'tools'` / `'full'` | the turn's trajectory: clipped, tool calls only, everything |
  | `checks: true` / `['npm test']` | `c.exec` results, or those commands' |
  | `observations: true` / `['orm']` | `c.observe` values, or those names' |
  | `artifacts: true` / `[shot, 'home']` | captures, sent as file parts |

  Pick the inputs the question needs, usually one or two: a question about code reads `diff` or
  `contents`, one about the agent's answer `output`, one about how it worked `trajectory`, one
  about a screenshot `artifacts`. Spell out `{ task: true, output: true, diff: true }` only when
  the question needs all three. The diff leaves out dependencies, build output (`dist/`,
  `.next/`, top-level `build/` and `out/`), lockfiles, `*.map`, `*.tsbuildinfo` and minified
  files.
- `turns` selects what `task`, `output`, `trajectory` and `diff` read and shows nothing alone:
  `turns: 'all'` adds every turn before the last one.
- Ask about facts in a captured picture, not whether it "looks great". Jev
  (`typesafe-ai/jev-1.14.0`) takes PNG captures; a provider that cannot take files fails that
  call. Prefer deterministic checks for what can be checked; use the judge for quality, with
  plain yes/no questions that don't name one specific way of doing it.
- Give the environment a `.gitignore` in `files` (the project's isn't copied in): an agent that
  runs a build otherwise fills the judge's diff with its output. reeval sends every input the
  grader turns on, uncut, and knows no model's limit: a provider error refusing it keeps the
  provider's wording and adds one line with the input's estimated size, biggest files and the
  inputs that were on, largest first; narrow one, e.g. `{ diff: ['src/'] }`.
- A judge grader whose provider fails after its retries, or that times out, ends the attempt
  `infra_error`, which `--retry-errors` runs again; one the model refuses, or answers malformed,
  scores 0 with its `error`, and the other graders still run.

## Trustworthy evals

Before a real run, prove each check can pass and fail with the fake harness in the eval's real
sandbox: an oracle `fakeAgent` that does the task right (must pass) and a canary that cheats
or gets it wrong (must fail). A canary that passes means a check isn't checking. Give each check
you rely on a canary that only it catches.

```ts
// reeval.config.ts: the real harness, plus two profiles that swap only the harness and judge
export default defineConfig({
  agents: cursor({ model: 'composer-2.5' }),
  profiles: {
    oracle: {
      defaults: {
        agents: fakeAgent({ files: { 'greet.js': 'export const greet = …' } }),
        judge: { model: fakeJudge({ score: 0.95 }) },
      },
    },
    canary: {
      defaults: {
        agents: fakeAgent({ files: { 'greet.test.js': "test('greets', () => {})\n" } }),
        judge: { model: fakeJudge({ score: 0.1 }) },
      },
    },
  },
})
```

```bash
npx reeval image build --profile oracle   # once: the eval's images
npx reeval run --profile oracle           # every eval scores 100%
npx reeval run --profile canary           # the graders you meant miss
```

- Set `defaults.agents`, never `defaults.sandbox`: the environment's `docker()` (image,
  `install`, egress, brokered secrets) stays, so the checks run where they will for real. A
  profile's `sandbox` only fills in for an environment that omits one, and the fake harness
  without `layout` uses Cursor's image; `layout: 'claude-code'` (or another agent id) uses that
  agent's image and reads rules and skills where it does.
- `script` steps (`{ exec }`, `{ write }`, `{ mcp }`) run inside the container as the agent, so an
  oracle can run the real fix (`{ exec: 'node scripts/solve.mjs' }`) or call a brokered API.
- `fakeJudge` checks the wiring (a low score fails the check); keep the real `judge.model` on the
  oracle, with its key, to check that a question passes good work.
- `fakeSandbox()` isn't the oracle's sandbox: it runs on the host, brokers nothing and enforces no
  egress. It's for trying reeval and testing configs without Docker.
- An eval that sets its own `agents` and `pin: ['agents']` keeps it (the plan notes `agents set by the eval`), and a non-blocking cell's (a default `capability()` eval's, a control's) failed checks don't change the
  exit code: its row in the result block shows its count (`plain  0 of 4`).

Keep grading out of the
agent's reach: run hidden tests in a `defineGrader` with `env: docker()` and `data`, so the agent never sees
them, seed tests in `files` only when the agent should see them, and guard seeded files
with `notInDiff(path, { required: true })`.
When the behavior is the
outcome, judge the program's output, not the diff: `await c.exec('node app.js')` in the task and
`judge(q, { inputs: { checks: ['node app.js'] } })`. The task's `c.exec` runs in the agent's
container as the same user, which suits AX evals but isn't a sealed verifier; a grader with `env` runs in a sandbox of its own.

## Trajectory graders

- `usedSkill(name)`, `calledMcp(server, tool)`, `calledTool(name | RegExp, input?)`,
  `ran(command?)`, `wrote(path?)`, `searched(query?)` and `fetched(url?)`, from
  `reeval/graders`. `ran(string | RegExp)` matches the whole command line, so `/genkit/` passes
  on `cat genkit.config.ts`; `ran({ program, args? })` matches the program a segment (split on
  line breaks, `&&`, `||`, `;`, `|`, `&`) ran, by its name without a directory, after `VAR=x`,
  `env`, `timeout`, `time`, `exec`, `sudo`, `nohup`, `nice`, `command`, `if`/`then`/`do`,
  `bash -c`, `npx`, `bunx`, `npm exec`, `pnpm exec`/`dlx` and `yarn dlx`; `args` (joined by
  spaces) is a substring or RegExp, e.g. `/^add\b/`. `pnpm <bin>` and `npm run` aren't
  unwrapped, and a run counts even if its call failed. `shellCommands(c | turn | c.turns)`
  returns those programs to count or filter. `usedSkill` is opened or loaded (a `skill` /
  `Skill` / `load_skill` tool, or a Read/`sed` of `skills/<name>/`, on every harness), not
  "followed". MCP is `calledMcp(server, tool)` (the names in `mcp.<server>`);
  `calledTool('mcp__<server>__<tool>')` is the raw trajectory name. After adapters and the
  normalizer, that string is the same on every harness (stdio; Goose, OpenCode, pi and Codex
  refuse `mcp.sse`). Use `wrote` / `searched`, not `calledTool('edit')` or `'webSearch'`.
- Budgets: `withinLimits({ tokens: 20_000, toolCalls: 30, duration: '5m' })` caps the turns'
  summed tokens, tool calls (a number, or `{ bash: 5 }` per tool) and time. Tokens include
  subagents.
- Guard files the agent must leave alone with `notInDiff(['test/**', 'package.json'])`: it reads
  the workspace diff, so a shell or subprocess write counts and a read doesn't. Strings are globs
  (a directory matches everything under it) and RegExps work. `wrote` counts the paths the
  agent's write and edit tool calls touched. Gitignored files don't appear in the diff, so use
  `hasFile()` to check them.
- The task fails the attempt when it throws: a plain `assert`, an `EvalError`, a dead sandbox or
  a timeout ends it there.
- **Name each requirement** with a grader's `name` option:
  `hasFile('greet.js', /export/, { name: 'exports greet' })`. Changing a name changes the eval's
  fingerprint. Name judges too (`judge(q, { name: 'social-oauth', inputs: { diff: true } })`).
