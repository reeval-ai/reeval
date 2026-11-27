# with-checks

**Shows:** deterministic graders on what the agent left behind. The agent adds `multiply(a, b)` to
a small package, the task runs the tests with `c.exec`, and three graders from `reeval/graders`
score the trial: `hasFile` on the source and on the test file, and `succeeded` on the tests.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade. `pnpm eval --profile claude-code` runs the same eval on Claude
Code, and `--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the result block. The trial scores the mean of its graders, and `-v` names
each grader that scored below 1, here with the fake agent's `multiply` changed to add:

```text
with-checks.eval.ts
  · with-checks  mean 67% · 0/1 trial at 100% (pass@1)  capability(1)
    #1  67%  succeeded:node --test 0%
```

The trial's `execs.jsonl` has the test run the grader read, with its exit code and output.

| File | What it is |
|---|---|
| [`with-checks.eval.ts`](./with-checks.eval.ts) | The eval: one prompt, a test run and three graders |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

Graders are in the [Authoring API reference](../../docs/reference/authoring-api.mdx).
