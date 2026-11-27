# with-skip

**Shows:** three evals, one file each, sharing the options in `reeval.config.ts` (`timeout`, `trials`
and `target`) and the environment in `environments.ts`, each graded by one `observed` grader.
`adds-subtract` overrides `trials` and adds a tag of its own, and `adds-divide` sets `skip` with a
reason, so it stays declared but unrun.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade. `pnpm eval --profile claude-code` runs the same evals on Claude
Code, and `--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the plan, from `pnpm reeval run --dry-run`. Each eval's id is its file's name.
`adds-multiply` takes the config's two trials, `adds-subtract` its own one, and `adds-divide` plans
no trials, with its reason in the notes:

```text
eval           agents  variants  trials  total  target         notes
adds-divide    0       —         2       0      capability(1)  skipped: divide by zero isn't specified yet
adds-multiply  1       —         2       2      capability(1)
adds-subtract  1       —         1       1      capability(1)
```

The default target, `capability()`, passes a cell when one of its runs passes and only reports;
`regression()` would need both and fail the run on a miss. Every eval is tagged `math`, so `pnpm reeval run
--tag smoke --dry-run` plans only `adds-subtract`, and `--tag math` plans all three. The run's
status list ends:

```text
adds-divide.eval.ts
  – adds-divide  skipped

adds-multiply.eval.ts
  · adds-multiply  mean 100% · 2/2 trials at 100% (pass@2)  capability(1)

adds-subtract.eval.ts
  · adds-subtract  mean 100% · 1/1 trial at 100% (pass@1)  capability(1)

Done in 2s · 3 evals · 2 report only · 1 skipped
```

| File | What it is |
|---|---|
| [`adds-multiply.eval.ts`](./adds-multiply.eval.ts) | An eval on the config's options |
| [`adds-subtract.eval.ts`](./adds-subtract.eval.ts) | An eval with its own `trials` and a `smoke` tag |
| [`adds-divide.eval.ts`](./adds-divide.eval.ts) | An eval with `skip` and its reason |
| [`environments.ts`](./environments.ts) | The `math` environment the three share |
| [`checks/call.mjs`](./checks/call.mjs) | Prints a `src/math.js` function's result; placed in the sandbox's home, outside the workspace |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The options every eval shares, the fake agent, and the real agents from `../profiles.ts` |

`defineEval` and `skip` are in the [Authoring API reference](../../docs/reference/authoring-api.mdx)
reference, and how each option merges in [Options](../../docs/reference/options.mdx).
