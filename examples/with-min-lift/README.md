# with-min-lift

**Shows:** failing a variant that doesn't clearly help. `minLift: 0.2` fails the variant cell
unless the lower bound of its lift's 95% interval is above +20 points. The agent adds
`multiply(a, b)`, with and without a `jsdoc` skill, and a grader looks for its JSDoc block.
`target: metric(0.75)` lets each arm miss one of its four tries.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade; here it writes the JSDoc block only when it has the skill.
`pnpm eval --profile claude-code` runs the same compare on Claude Code, and `--profile <name>` on
any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the skill helps every time, and its interval clears the bar:

```text
with-min-lift.eval.ts
  ✓ with-min-lift  100% ≥ 75%  metric(0.75)
    arm              pass
    math             0 of 4
      error  score 0.00 below 0.75: has-file:src/math.js scored 0.00 (4 runs)
    jsdoc            4 of 4  helped
```

`pnpm reeval query "SELECT variant, points, lo, hi, min_lift, outcome FROM lift"` has the
interval: 4 of 4 against 0 of 4 is a lift of +100 points, and at four tries a side the interval
reaches down to +30.7.

```text
variant  points  lo     hi  min_lift  outcome
jsdoc    1       0.307  1   0.2       pass
```

Raise the bar to `minLift: 0.5` and the same attempts fail the run, which exits 1. Four tries a
side can't show a lift that sure; more runs narrow the interval:

```text
with-min-lift.eval.ts
  ✗ with-min-lift  100% ≥ 75%  metric(0.75)
    arm              pass
    math             0 of 4
      error  score 0.00 below 0.75: has-file:src/math.js scored 0.00 (4 runs)
    jsdoc            4 of 4  helped, not by minLift 50
    …
Done in 2s · 1 eval · 1 below
```

The target gates the variant cells only; the control reports. `minLift` needs a target that can
fail the run.

| File | What it is |
|---|---|
| [`with-min-lift.eval.ts`](./with-min-lift.eval.ts) | The eval: the compare with `minLift`, four runs and a mean-score target |
| [`skills/jsdoc/SKILL.md`](./skills/jsdoc/SKILL.md) | The skill under test |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace, without and with the skill |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

[Measure lift against a control](../../docs/results/compare/lift.mdx) covers `minLift`.
