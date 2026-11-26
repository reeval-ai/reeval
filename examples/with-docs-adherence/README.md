# with-docs-adherence

**Shows:** following a docs file you seeded. The environment adds `docs/conventions.md` to the
package with `files` and `file()`, the agent adds a `deleteNote` handler, and a judge given the
handler, its tests and the docs whole (`{ contents }`) grades whether every rule was followed.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code, which also
covers its profile's judge), Docker, and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent and a fake judge with a fixed score, with no
keys or Docker. It copies the [`fake-agent/`](./fake-agent) fixture into the workspace to mimic what
an agent would produce, so the graders have something to grade. `pnpm eval --profile claude-code`
runs the same eval on Claude Code, with a real judge, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the judge grader's grade in the run record, under `.reeval/runs/`. It read
the three files, and nothing else:

```json
{
  "grader": "judge:Does deleteNote, and its tests, follow every rule in docs/conventions.md?",
  "kind": "judge",
  "grade": true,
  "score": 1,
  "reads": {
    "files": [
      { "path": "docs/conventions.md", "sha256": "b74859d9…" },
      { "path": "src/notes.js", "sha256": "61f0657a…" },
      { "path": "test/notes.test.js", "sha256": "c9d20d9c…" }
    ]
  },
  …
}
```

| File | What it is |
|---|---|
| [`with-docs-adherence.eval.ts`](./with-docs-adherence.eval.ts) | The eval: the task, two graders and a judge grader on the docs |
| [`docs/conventions.md`](./docs/conventions.md) | The conventions the environment seeds into the workspace |
| [`project/`](./project) | The package the agent starts from: `src/notes.js` and its tests |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace: the handler and its tests |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and judge, and the real agents from `../profiles.ts` |

What the judge is given is in the [Judge agent work](../../docs/evaluations/grading/judgments.mdx).
