# with-compare-baseline

**Shows:** a compare that names its baseline. `compare: { baseline: math, variants: [withTesting] }`
measures the `testing` variant against `math`, which is what the eval runs in without the skill.
The agent adds `multiply(a, b)`, and a grader looks for its test, as the `testing` skill asks.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade; here it adds the test only when it has the skill.
`pnpm eval --profile claude-code` runs the same compare on Claude Code, and `--profile <name>` on
any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the baseline is named after its environment, `math`:

```text
with-compare-baseline.eval.ts
  · with-compare-baseline  mean 100% · 4/4 trials at 100% (pass@4)  capability(1)
    environment      pass
    math             0 of 4
      error  score 0.50 below 1: has-file:test/math.test.js scored 0.00 (4 trials)
    testing          4 of 4  helped
```

The run record names the baseline: `evals[].compare` is `{ "baseline": "math" }`. The eval sets
no `trials`, so each environment runs four times, enough for the verdict.

| File | What it is |
|---|---|
| [`with-compare-baseline.eval.ts`](./with-compare-baseline.eval.ts) | The eval: the baseline, the variant and two graders |
| [`skills/testing/SKILL.md`](./skills/testing/SKILL.md) | The skill under test |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace: `src/math.js`, and the test with the skill |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

[Measure lift against a baseline](../../docs/results/compare/lift.mdx) covers the baseline and its variants.
