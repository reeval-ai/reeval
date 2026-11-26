# with-jev

**Shows:** Jev, reeval's recommended judge model, `typesafe-ai/jev-1.14.0`. The agent writes a
README for a small package, a `hasFile` grader looks for a usage example, and a `judge` grader asks
Jev whether a new user could call the function from it, shown the README and the source.
`RECOMMENDED_JUDGE_MODEL` from `reeval/judge` is the same string.

**Needs:** `TYPESAFE_AI_API_KEY` in `.env.local`, even for the fake agent; in this repo, run
`pnpm install && pnpm build` at the root first. A real agent also needs its key
(`ANTHROPIC_API_KEY` for Claude Code), Docker, and `pnpm reeval image build --profile claude-code`
once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no agent key or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
Jev has something to judge. `pnpm eval --profile claude-code` runs the same eval on Claude Code,
and `--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts). The judge
is set on the eval, so Jev judges under every profile.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the judge's grade in the run record, `.reeval/runs/<run>.json`: Jev's answer
and its probability, under `judge.calls`, and the README and source it read, under `reads`.

With `gateway: [vercel()]` in the config, Jev takes `AI_GATEWAY_API_KEY` instead; see
[`with-vercel-gateway`](../with-vercel-gateway).

| File | What it is |
|---|---|
| [`with-jev.eval.ts`](./with-jev.eval.ts) | The eval: one prompt, a grader and Jev |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

Judge models and their keys are in the [Judge agent work](../../docs/evaluations/grading/judgments.mdx).
