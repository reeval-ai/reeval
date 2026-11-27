# with-judge-providers

**Shows:** judges on different providers, each called with its provider's own key. The agent adds
`average(xs)`, and the same question goes to `anthropic/claude-sonnet-5` and
`google/gemini-3.8-flash`, both named in one `judge` grader's `models`: the score is their answers'
mean. Failing tests throw `EvalError`, so the trial scores 0 before either judge is called.

**Needs:** `ANTHROPIC_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`, even for the fake
agent; in this repo, run `pnpm install && pnpm build` at the root first. A real agent also needs
its key (Claude Code's is `ANTHROPIC_API_KEY` again), Docker, and
`pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no agent key or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the judges have something to judge. `pnpm eval --profile claude-code` runs the same eval on
Claude Code, and `--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).
A grader's `models` win over every profile's judge, so the same two judges score each agent.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the judge's grade in the run record, `.reeval/runs/<run>.json`: one call per
model under `judge.calls`, each with its answer, probability, tokens and cost, trimmed:

```text
"grader": "judge:Would a new reader follow average, with the empty list handled on purpose?",
"score": 1,
"judge": {
  "calls": [
    { "model": "anthropic/claude-sonnet-5", "answer": true, "probability": 0.9, … },
    { "model": "google/gemini-3.8-flash", "answer": true, "probability": 0.98, … }
  ]
}
```

| Prefix | Key |
|---|---|
| `anthropic/` | `ANTHROPIC_API_KEY` |
| `google/` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `openai/` | `OPENAI_API_KEY` (its decision model: `openai/gpt-6-luna`) |
| `typesafe-ai/` | `TYPESAFE_AI_API_KEY` (Jev: see [`with-jev`](../with-jev)) |

| File | What it is |
|---|---|
| [`with-judge-providers.eval.ts`](./with-judge-providers.eval.ts) | The eval: one prompt, a grader and a judge on two models |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

Providers and their keys are in [Judge agent work](../../docs/evaluations/grading/judgments.mdx).
