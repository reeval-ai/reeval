# with-judge-on-output

**Shows:** judging what the program prints, not the diff. The agent writes `summary.js` for an
`orders.csv`, the task runs it, and a `judge` grader with `inputs: { checks: ['node summary.js'] }`
asks whether what it printed has the right count and total.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code, which
also covers its judge), Docker, and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent and a fake judge, with no keys or Docker. The
agent copies the [`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent
would produce, so there's a program to run. `pnpm eval --profile claude-code` runs the same eval
on Claude Code, judged by `anthropic/claude-sonnet-5`, and `--profile <name>` on any other agent
in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the grade lines in `pnpm eval -v`. The judge sees only the stored run of
`node summary.js`, its exit code and output, which the attempt's `execs.jsonl` also keeps:

```text
[judge#1 fake] 08:06:26 check     grade succeeded:node summary.js score 1 (4ms)
[judge#1 fake] 08:06:26 check     grade judge:Does it say there are 3 orders totaling 50? score 1 (7ms)
```

| File | What it is |
|---|---|
| [`with-judge-on-output.eval.ts`](./with-judge-on-output.eval.ts) | The eval: one prompt, a run of the program and a judge on its output |
| [`project/`](./project) | What the agent starts from: `orders.csv` |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and judge, and the real agents from `../profiles.ts` |

Why to judge output is in [Judge agent work](../../docs/evaluations/grading/judgments.mdx).
