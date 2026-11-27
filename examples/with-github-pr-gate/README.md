# with-github-pr-gate

**Shows:** a pull request check that fails when an eval regresses. [`workflow.yml`](./workflow.yml)
runs the evals on Claude Code in GitHub Actions, then `reeval compare --fail-on-regression` against
the nearest recorded run on the base branch. `defaultProfile: { ci: 'pr' }` picks the `pr` profile
whenever `CI` is set, and `record: 'ci'` records the run there.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. In GitHub Actions, an `ANTHROPIC_API_KEY` repository secret (Settings › Secrets and
variables › Actions). A real agent locally needs its key in `.env.local`, Docker, and
`pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade. In CI, the `pr` profile is Claude Code's from
[`examples/profiles.ts`](../profiles.ts) with one trial per cell and a budget; locally,
`pnpm eval --profile pr` runs the same, and `--profile <name>` runs any other agent in that file.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need. Copy [`workflow.yml`](./workflow.yml) into your repository's
`.github/workflows/evals.yml`; it expects the project at the repository's root.

**What to look at:** what CI plans. `CI=1` picks `pr` as Actions does:

```bash
CI=1 pnpm reeval run --dry-run
```

```text
REEVAL v0.31.0  dry run

  ➜  Run:       20261126T080732Z_…
  ➜  Profile:   pr (auto: CI is set)
  ➜  Agent:     claude-code:claude-sonnet-5 (effort: medium)
  ➜  Sandbox:   docker
  ➜  Judge:     anthropic/claude-sonnet-5
  ➜  Scope:     1 eval file · 1 eval · 1 cell · 1 trial (budget: 20 ✓)
  ➜  Est. Time: ~3m 00s (serial)

eval                 agents  variants  runs  trials  target         notes
with-github-pr-gate  1       —         1     1         regression(1)
  grader 1/2  has-file:src/math.js · built-in · weight 1
  grader 2/2  succeeded:node --test · built-in · weight 1
images  1 sandbox image: 1 ready
  ✓ docker · claude-code  ready
…
```

In the workflow, a failing eval (exit 1) doesn't fail the run step: the compare step decides,
writing its blocks to the job summary and exiting 1 on a regression. Until the base branch has a
recorded run to compare with, every eval is new and only a failing one fails the check. To give
pull requests that base, record runs on your main branch into the history folder and commit them;
the [Run evaluations in CI](../../docs/evaluations/runs/ci.mdx) page does it every night.

| File | What it is |
|---|---|
| [`with-github-pr-gate.eval.ts`](./with-github-pr-gate.eval.ts) | The eval: one prompt, two graders |
| [`workflow.yml`](./workflow.yml) | The GitHub Actions workflow to copy into `.github/workflows/` |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, the `pr` profile, and the real agents from `../profiles.ts` |

The [Fail a pull request](../../docs/evaluations/recipes/gate-pull-requests.mdx) recipe explains each step
and adds an image cache.
