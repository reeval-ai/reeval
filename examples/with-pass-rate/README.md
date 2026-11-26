# with-pass-rate

**Shows:** a cell that passes on most tries, not all of them. The agent adds `multiply(a, b)` five
times (`runs: 5`), and `target: metric(0.6)` passes the cell when the tries' mean score is 0.6 or
more. The `hasFile` grader is `required`, so a try without `multiply` scores 0 and the mean is the
share of passing tries: three or more. `regression()` needs all five, which an agent that's right
four times in five manages only a third of the time.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade; with `flakeRate: 0.2` it writes nothing on about one try in
five, at random, so each run's count differs. `pnpm eval --profile claude-code` runs the same eval
on Claude Code, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval -v`. Two of five tries missed here, and the cell is still on target:

```text
with-pass-rate.eval.ts
  ✓ with-pass-rate  60% ≥ 60%  metric(0.6)
    #1, 3, 5  100%
    #2, 4     0%    has-file:src/math.js 0% (required)
```

On a run with three misses it reads `✗ with-pass-rate  40% < 60%`, and the run exits 1. Five tries
is a small sample: `pnpm eval --runs 100` shows the fake agent's rate around 0.8.

| File | What it is |
|---|---|
| [`with-pass-rate.eval.ts`](./with-pass-rate.eval.ts) | The eval: five runs, a mean-score target and two graders |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The flaky fake agent, and the real agents from `../profiles.ts` |

Targets are in the [Options reference](../../docs/reference/options.mdx#target), and pass@1 and
pass^k in [How statistics work](../../docs/reference/statistics.mdx).
