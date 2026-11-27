# with-cases

**Shows:** one task over a list of cases. `cases` runs the eval once per case: the agent adds one
function to `src/math.js` (`subtract`, `multiply`, `power`), and the task calls it with that case's
numbers through [`checks/call.mjs`](./checks/call.mjs) and observes the answer. Each case is an
object whose `key` names it; the `answers` grader reads the trial's case as `c.case`, typed by
`defineGrader<{ want: string }>`, and the cases make one eval.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade; it writes every case's function each time. `pnpm eval --profile
claude-code` runs the same evals on Claude Code, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval -v`: one eval with three cases, each case a trial. Here the fake
agent's `power` multiplies instead:

```text
with-cases.eval.ts
  · with-cases  mean 67% · 2/3 cases hit 100% (pass@1)  capability(1)
    #subtract  100%
    #multiply  100%
    #power     0%    answers 0%
    Observed:
      answer  4 1 · 6 1 · 10 1
```

`pnpm reeval run --dry-run` plans the eval as one row. Each case's `key` is its trial's name
(`with-cases#power`), and `pnpm reeval run power` runs one case.

| File | What it is |
|---|---|
| [`with-cases.eval.ts`](./with-cases.eval.ts) | The cases, the grader that reads them and the one task they share |
| [`checks/call.mjs`](./checks/call.mjs) | Prints a `src/math.js` function's result; placed in the sandbox's home, outside the workspace |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

Cases, their keys and a paired lift over cases are in the
[Evaluate many cases](../../docs/evaluations/task/cases.mdx) page.
