# with-rules-ab

**Shows:** which of two rules files works better. Each arm is the same project with its own
`rules: file(…)`, a one-line `rules/short.md` and a `rules/detailed.md` that spells out the
changelog's format. `compare: { control: shortRules, variants: [detailedRules] }` runs both, and
the graders read the changelog the agent wrote.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade. A scripted shell step reads its rules (`AGENTS.md`) as an agent
would: where they spell out the `- feat: …` format it writes that entry, and where they only ask
for a changelog it writes a plain line. `pnpm eval --profile claude-code` runs the same compare
on Claude Code, where the rules land in `CLAUDE.md`, and `--profile <name>` on any other agent
in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** an arm per rules file, and the grader that tells them apart under the
control:

```text
with-rules-ab.eval.ts
  · with-rules-ab  100%  metric()
    arm              pass
    short-rules      0 of 4
      error  score 0.50 below 1: has-file:CHANGELOG.md scored 0.00 (4 runs)
    detailed-rules   4 of 4  helped
```

The eval sets no `runs`, so the compare runs each arm four times, the fewest whose lift often holds.
`pnpm eval --runs 1` is a cheaper smoke run that shows only a direction.

| File | What it is |
|---|---|
| [`with-rules-ab.eval.ts`](./with-rules-ab.eval.ts) | The eval: two arms, each with its own rules, and two graders |
| [`rules/short.md`](./rules/short.md) | The control's rules: one line |
| [`rules/detailed.md`](./rules/detailed.md) | The variant's rules: the changelog's format, with an example |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace; its changelog step is in `reeval.config.ts` |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and its rules-following step, and the real agents from `../profiles.ts` |

[Measure lift against a control](../../docs/results/compare/lift.mdx) covers naming both arms, and
[Add project rules](../../docs/configuration/environments/rules.mdx) covers `rules`.
