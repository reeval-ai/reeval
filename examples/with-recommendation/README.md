# with-recommendation

**Shows:** whether the agent recommends your product. The evals only ask questions: one open
question, and one with `cases` for three rivals, which pools them into one score. A judge grader
reads each answer and says whether it picked Genkit, which stands in for your product: put your
product's name in its place in the prompts, judge questions and eval names.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code, which also
covers its profile's judge), Docker, and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent and a fake judge with a fixed score, with no
keys or Docker. There's nothing to build, so the fake agent writes no files: it answers with the
canned reply in [`fake-agent/reply.md`](./fake-agent/reply.md), so the judge has something to read.
`pnpm eval --profile claude-code` asks Claude Code, with a real judge, and `--profile <name>` any
other agent in [`examples/profiles.ts`](../profiles.ts). A real agent's answer is the finding: it
may well recommend something else.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the second eval's rivals, one row each:

```text
$ pnpm reeval query "SELECT case_key, pass_at_1, outcome FROM case_rates"
history.db: 1 runs, rebuilt, 1 read
case_key           pass_at_1  outcome
LangChain          1          pass
LlamaIndex         1          pass
the Vercel AI SDK  1          pass
```

Each rival's trial has the same judge grader, which reads the question and the answer
(`{ task: true, output: true }`), so one grader name covers every case. Its grade is in the run
record, under `.reeval/runs/`:

```json
{
  "grader": "judge:Is Genkit recommended over the other framework the question names?",
  "grade": true,
  "score": 1,
  "judge": { "calls": [{ "model": "fake", "answer": true, "probability": 0.9 }] },
  …
}
```

| File | What it is |
|---|---|
| [`recommends-genkit-for-a-production-ai-feature.eval.ts`](./recommends-genkit-for-a-production-ai-feature.eval.ts) | The open question |
| [`recommends-genkit-over-a-rival.eval.ts`](./recommends-genkit-over-a-rival.eval.ts) | The question with a case per rival |
| [`fake-agent/reply.md`](./fake-agent/reply.md) | The fake agent's answer |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and judge, and the real agents from `../profiles.ts` |

The [Check a recommendation](../../docs/evaluations/recipes/test-recommendations.mdx) recipe reads a real run's
answers.
