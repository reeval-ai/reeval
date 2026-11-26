# with-hidden-tests

**Shows:** grading with a test the agent never saw. The agent implements `slugify(text)` from a
stub, then a sandboxed grader copies the agent's `src/` into its own Docker container, places
[`hidden/slugify.test.js`](./hidden/slugify.test.js) there and runs it, so the agent can't read or
edit what it's graded by. The grade is the share of the hidden tests that pass.

**Needs:** Docker, for the grader's container; in this repo, run `pnpm install && pnpm build` at the
root first. A real agent also needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code),
Docker, and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade. `pnpm eval --profile claude-code` runs the same eval on Claude
Code, and `--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval -v`'s result block. Here the fake agent's `slugify` keeps
punctuation, so one of the three hidden tests fails:

```text
with-hidden-tests.eval.ts
  · with-hidden-tests  mean 67% · 0/1 run at 100% (pass@1)  capability(1)
    #1  67%  hidden-tests 67%
```

The run record's grade lists the files the grader read, with their hashes. The attempt's
`diff.patch` has only `src/slugify.js`: the hidden test never enters the agent's workspace.

| File | What it is |
|---|---|
| [`with-hidden-tests.eval.ts`](./with-hidden-tests.eval.ts) | The eval: the prompt, and the grader that runs the hidden test |
| [`hidden/slugify.test.js`](./hidden/slugify.test.js) | The test the agent never sees |
| [`project/`](./project) | The package the agent starts from: a `src/slugify.js` stub |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

Sandboxed graders are in the [Authoring API reference](../../docs/reference/authoring-api.mdx).
