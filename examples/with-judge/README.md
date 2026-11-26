# with-judge

**Shows:** an LLM judge for the quality a deterministic grader can't read. The agent adds
`divide(a, b)` to a small package, two graders look for it and read the test run, and a `judge`
grader asks whether the error for a zero divisor would help a caller, shown the diff with
`inputs: { diff: true }`. A yes scores 1.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code, which
also covers its judge), Docker, and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent and a fake judge, with no keys or Docker. The
agent copies the [`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent
would produce, and `fakeJudge` answers every question yes with a probability of 0.9, so the graders
have something to grade.
`pnpm eval --profile claude-code` runs the same eval on Claude Code, judged by
`anthropic/claude-sonnet-5`, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts): a profile's judge model wins over the config's.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the grade lines in `pnpm eval -v`, one per grader:

```text
[judge#1 fake] 08:05:33 check     grade has-file:src/math.js score 1 (14ms)
[judge#1 fake] 08:05:33 check     grade succeeded:node --test score 1 (9ms)
[judge#1 fake] 08:05:33 check     grade judge:Would the error divide throws when b is 0 tell a caller what they~e7ba12e5 score 1 (16ms)
```

The run record's grade for the judge keeps each model's answer and its probability, under
`judge.calls`.

| File | What it is |
|---|---|
| [`with-judge.eval.ts`](./with-judge.eval.ts) | The eval: one prompt, two graders and a judge |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and judge, and the real agents from `../profiles.ts` |

Which model a judge calls is in [Judge agent work](../../docs/evaluations/grading/judgments.mdx),
and `judge()` in the [Authoring API reference](../../docs/reference/authoring-api.mdx). For the
recommended judge model, see [`with-jev`](../with-jev).
