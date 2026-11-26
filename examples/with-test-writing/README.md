# with-test-writing

**Shows:** grading tests by whether they catch a bug. The agent writes tests for
`src/duration.js`; they must pass, and then a grader copies them into a sandbox of its own,
swaps in a mutant (a copy with one bug planted) and checks the same tests now fail there.

**Needs:** Docker, where the mutant runs, even for the fake agent; in this repo, run
`pnpm install && pnpm build` at the root first. A real agent also needs its key in `.env.local`
(`ANTHROPIC_API_KEY` for Claude Code) and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade; here it's a test file that covers combined units.
`pnpm eval --profile claude-code` runs the same eval on Claude Code, and `--profile <name>` on any
other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval --profile canary` runs a fake agent whose one test passes but
never tries two units together, so the mutant gets through, and the required grader scores the
attempt 0:

```text
with-test-writing.eval.ts
  ✗ with-test-writing  mean 0% · 0/1 run at 100%  regression(1)
    #1  0%  catches-the-mutant 0% (required)
    …
```

| File | What it is |
|---|---|
| [`with-test-writing.eval.ts`](./with-test-writing.eval.ts) | The eval: the tests pass, then a grader's mutant must fail them |
| [`project/`](./project) | The package the agent starts from: `src/duration.js`, untested |
| [`hidden/duration.js`](./hidden/duration.js) | The mutant: only the last unit counts |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace: good tests |
| [`canary/`](./canary) | What the `canary` profile's agent writes instead: a test too weak to catch it |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, the canary, and the real agents from `../profiles.ts` |

`graders` is in the [Options](../../docs/reference/options.mdx#graders) reference.
