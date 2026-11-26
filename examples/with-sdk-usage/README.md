# with-sdk-usage

**Shows:** whether an agent uses your SDK correctly. The environment seeds a small SDK into
`vendor/acme` with `directory(path, { into })`; the agent writes `forecast(city)` with it. A
grader runs a check script the agent never sees against it in a sandbox of its own, with a
stand-in API that answers `503` once, and a judge grader asks whether it used the SDK's
`client.retry` rather than its own loop.

**Needs:** Docker, where the check script runs, even for the fake agent; in this repo, run
`pnpm install && pnpm build` at the root first. A real agent also needs its key in `.env.local`
(`ANTHROPIC_API_KEY` for Claude Code, which also covers its profile's judge) and
`pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent and a fake judge with a fixed score, with no
keys. It copies the [`fake-agent/`](./fake-agent) fixture into the workspace to mimic what
an agent would produce, so the graders have something to grade. `pnpm eval --profile claude-code`
runs the same eval on Claude Code, with a real judge, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** a `forecast()` that calls `client.weather` without retrying scores 0 on
`check-client`, which is required, so the attempt scores 0 whatever the judge says. Its grade in
the run record, under `.reeval/runs/`, says why:

```json
{
  "grader": "check-client",
  "kind": "code",
  "grade": {
    "exitCode": 1,
    "stderr": "…AcmeError: Acme API answered 503\n    at Object.weather (file:///reeval/workspace/vendor/acme/index.js:15:24)\n    at async forecast (file:///reeval/workspace/src/forecast.js:5:21)\n…"
  },
  "score": 0,
  "weight": 1,
  "required": true,
  …
}
```

| File | What it is |
|---|---|
| [`with-sdk-usage.eval.ts`](./with-sdk-usage.eval.ts) | The eval: the task, the check script's grader and a judge grader |
| [`acme-sdk/`](./acme-sdk) | The SDK under test, seeded into `vendor/acme`: `index.js` and its `README.md` |
| [`hidden/check-client.mjs`](./hidden/check-client.mjs) | The check script: `forecast()` against a stand-in API |
| [`project/`](./project) | The empty package the agent starts from |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace: `src/forecast.js` |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and judge, and the real agents from `../profiles.ts` |

`directory()` and its options are in the [Environment helpers reference](../../docs/reference/environment-helpers.mdx).
