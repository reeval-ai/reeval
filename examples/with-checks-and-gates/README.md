# with-checks-and-gates

**Shows:** named graders that each score on their own, and an `EvalError` that fails the task when
the rest would mean nothing. The agent adds `divide(a, b)` to a small package, throwing on zero.
The task throws `EvalError` if `src/math.js` doesn't parse, so the attempt scores 0 and no grader
runs; otherwise four graders, each with a `name`, score one requirement.

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

**What to look at:** the result block. Every grader ran, and `-v` names each one that scored
below 1, here with the fake agent's throw removed:

```text
with-checks-and-gates.eval.ts
  · with-checks-and-gates  50%  metric()
    #1  50%  throws-a-range-error 0%, tests-pass 0%
```

With a `src/math.js` that doesn't parse, the task fails with the `EvalError`'s reason and its
`meta`, and no grader runs:

```text
with-checks-and-gates.eval.ts
  · with-checks-and-gates  0%  metric()
    #1  0%  src/math.js doesn't parse
      stderr: …/src/math.js:2 SyntaxError: Unexpected end of input …
      after turn 1
      at task (with-checks-and-gates.eval.ts:25:13)
    …
```

Each grade, with its grader's name, is in the run record's `grades`.

| File | What it is |
|---|---|
| [`with-checks-and-gates.eval.ts`](./with-checks-and-gates.eval.ts) | The eval: one prompt, an `EvalError` and four named graders |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

Graders and `EvalError` are in the [Authoring API
reference](../../docs/reference/authoring-api.mdx).
