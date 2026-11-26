# with-case-lift

**Shows:** a lift you can trust from one run a side. `cases` runs the same task for six
functions, and the compare pairs the control and the variant case by case, pooling the six into
one lift. `minLift: 0.2` gates that pooled lift, not each case's. The agent adds a
function to a small package, with and without a `jsdoc` skill.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade; here it writes every case's function, with JSDoc blocks only
when it has the skill. `pnpm eval --profile claude-code` runs the same eval on Claude Code, and
`--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** each case runs once a side, but the arms pool all six into `helped`.
`pnpm eval -v` prints each case's score and the pooled interval:

```text
with-case-lift.eval.ts
  ✓ with-case-lift  6/6 runs at 100%  regression(1)
    #subtract  100%
    #multiply  100%
    …
    arm              pass
    math             0 of 6
    jsdoc            6 of 6  helped
      paired over 6 cases, 95% interval +45…+100 points
```

After a run, `pnpm reeval query case_lift` has the same lift as a row, with its method
(`newcombe-paired`), its `min_lift` and the eval's pooled outcome.

| File | What it is |
|---|---|
| [`with-case-lift.eval.ts`](./with-case-lift.eval.ts) | The eval: six cases, one compare with `minLift`, and a grader that reads each case's function |
| [`skills/jsdoc/SKILL.md`](./skills/jsdoc/SKILL.md) | The skill under test |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace, without and with the skill |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

[Evaluate many cases](../../docs/evaluations/task/cases.mdx) in the
Suites of cases recipe covers the pooled lift.
