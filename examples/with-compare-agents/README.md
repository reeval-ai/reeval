# with-compare-agents

**Shows:** a compare on one agent while another runs only the baseline. The eval runs on Claude
Code and Codex, and `compare.harnesses` runs the `jsdoc` skill's variant on Claude Code alone. A
question with `across: 'agent'`, in `questions` beside `compare`, pairs Claude Code's trials
with Codex's in the same environment, so you read the two agents side by side.

**Needs:** `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `.env.local`, Docker, and
`pnpm reeval image build` once (it builds both agents' images). In this repo, run
`pnpm install && pnpm build` at the root first. `ANTHROPIC_API_KEY` also answers the question.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** there's no fake agent here. `compare.harnesses` names harness ids the eval
must run, so the eval names its own two agents, and that list wins over the config's and every
profile's: `--profile <name>` changes the judge, not the agents.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the plan, `pnpm eval --dry-run`, which needs no keys or Docker. It has three
cells, not four: Codex runs the baseline alone. The compare sets no `trials`, so each cell runs four
times, the graders score each trial, and the question pairs Claude Code's trials with
Codex's run by run:

```text
eval                 agents  variants  trials  total  target         notes
with-compare-agents  2       1         4       12     capability(1)  trials 4 (compare default)
  grader 1/2  succeeded:node --test · built-in · weight 1
  grader 2/2  has-file:src/math.js · built-in · weight 1
  question 1/1  Which multiply() is easier to read? · after the run · shows diff · agent · 4 pairs · anthropic/claude-sonnet-5
```

`pnpm reeval run --dry-run --json` lists the cells: `claude-code:claude-sonnet-5/math/docker`
(the baseline), `claude-code:claude-sonnet-5/jsdoc/docker` (the variant) and
`codex:gpt-5.6-luna/math/docker`. The default target, `capability()`, only reports.

| File | What it is |
|---|---|
| [`with-compare-agents.eval.ts`](./with-compare-agents.eval.ts) | The eval: two agents, a compare on one, and a question across them |
| [`skills/jsdoc/SKILL.md`](./skills/jsdoc/SKILL.md) | The skill under test |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`reeval.config.ts`](./reeval.config.ts) | The question's model, and the profiles from `../profiles.ts` |

The [Options](../../docs/reference/options.mdx) reference page covers `compare.harnesses` and
`questions`' `across`, and the [Ask questions across trials](../../docs/evaluations/grading/questions.mdx) page covers pairing.
