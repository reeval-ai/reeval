# with-vercel-gateway

**Shows:** an agent and its judge through Vercel AI Gateway, on one key. The `vercel` profile runs
Claude Code with `gateway: [vercel()]` and judges with Jev, so `AI_GATEWAY_API_KEY` covers both
and no Anthropic or Typesafe key is read. The task: add `multiply(a, b)`, with a test.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. The `vercel` profile needs `AI_GATEWAY_API_KEY` in `.env.local`, Docker, and
`pnpm reeval image build --profile vercel` once.

**Run:**

```bash
pnpm eval --profile vercel
```

**Real or fake agent:** `pnpm eval` runs a fake agent and a fake judge, with no keys or Docker. The
agent copies the [`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent
would produce, so the graders have something to grade. `pnpm eval --profile vercel` runs Claude
Code through Vercel, and `--profile <name>` runs any agent in
[`examples/profiles.ts`](../profiles.ts) on its own key (the `fx` one is on Vercel too).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the plan's note, then the judge's grade in the run's record, from a run
on Claude Code. Both went through Vercel:

```text
eval                 agents  variants  trials  total  target         notes
with-vercel-gateway  1       —         1       1      capability(1)  gateway: claude-code:claude-sonnet-5 → vercel
```

```text
"grader": "judge:Does the new test check multiply, not add?",
"kind": "judge",
"score": 1,
…
"judge": {
  "calls": [
    {
      "model": "typesafe-ai/jev-1.14.0",
      "answer": true,
      "probability": 0.88,
      "resolvedModel": "typesafe-ai/jev-1.14.0",
      "gateway": "vercel",
      …
```

Vercel serves Claude Code, Codex, Goose, pi, OpenCode, fx and Grok Build; the others (Cursor,
Antigravity) fall back to their own keys with `direct()`, which ends every list, unless you turn
it off with `direct({ enabled: false })`. Of the judge models there, only Jev answers.

| File | What it is |
|---|---|
| [`with-vercel-gateway.eval.ts`](./with-vercel-gateway.eval.ts) | The eval: one prompt, two graders and a judge |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent and judge, the `vercel` profile, and the real agents from `../profiles.ts` |

Gateways, fallback and pins are in the [Route models through a gateway](../../docs/configuration/gateways/index.mdx) page.
