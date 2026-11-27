# with-capture

**Shows:** judging a screenshot of the agent's page. The agent adds a "Sign up" button to a
one-page site; the task starts its server with `c.serve` and screenshots it with `c.capture`,
and a judge grader reads the PNG through `artifacts`. A deterministic grader reads the HTML.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. `--profile docker` needs Docker, and downloads Chrome (`chrome-headless-shell`) the first
time. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once; its judge must take images, as each
shared profile's does.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade, and a fake judge says yes to the screenshot. The fake sandbox
takes no real screenshot: it saves a 1×1 placeholder PNG. `pnpm eval --profile docker` runs the
same fake agent in Docker, where Chrome takes the real one, still with no keys.
`pnpm eval --profile claude-code` runs it on Claude Code, and `--profile <name>` on any other agent
in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the screenshot, in the trial's directory under `.reeval/runs/`:

```text
.reeval/runs/<run>/with-capture-179838/fake-site-fake-22c560/1/
  artifacts/home.png
  artifacts/home.capture.json
  diff.patch
  trajectory.jsonl
  workspace.tar.gz
  …
```

With `--profile docker` it's the 1280×720 page with its blue button. The run record's grade
names the capture the judge read, by its hash:

```json
{
  "grader": "judge:Does the screenshot show a \"Sign up\" button under the intro paragraph?",
  "kind": "judge",
  "grade": true,
  "score": 1,
  "reads": { "artifacts": [{ "name": "home", "sha256": "7fa3f76d…" }] },
  "judge": { "calls": [{ "model": "fake", "answer": true, "probability": 0.9 }] },
  …
}
```

| File | What it is |
|---|---|
| [`with-capture.eval.ts`](./with-capture.eval.ts) | The eval: the server and the screenshot in the task, a grader on the HTML and a judge grader on the screenshot |
| [`project/`](./project) | The site the agent starts from: `index.html` and `server.js` |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and judge, the `docker` profile, and the real agents from `../profiles.ts` |

The [Check an app](../../docs/evaluations/task/apps.mdx) page covers `c.serve`, `c.capture`,
waits and judging the screenshot.
