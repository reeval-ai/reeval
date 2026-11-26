# with-background-process

**Shows:** a server started during the attempt and checked over HTTP. The agent adds a `/health`
route to a small `node:http` server; the eval starts it with
`c.exec('node server.js', { background: true })`, calls the route with `curl`, records the
answer with `c.observe`, then stops it with `kill()`. The server lives only while the task runs,
so the graders read the stored `curl` result and the observation. The port is the environment's
`env: { PORT: '4100' }`, which the server and the task both read.

**Needs:** nothing for the fake agent but `curl` and a free port 4100; in this repo, run
`pnpm install && pnpm build` at the root first. A real agent needs its key in `.env.local`
(`ANTHROPIC_API_KEY` for Claude Code), Docker, and `pnpm reeval image build --profile claude-code`
once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade. The fake sandbox runs the server on your machine, so the port
must be free there; change `PORT` in the eval if it isn't. `pnpm eval --profile claude-code` runs
the same eval on Claude Code, in Docker, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval -v`. The background command returns at once; the `curl` run,
labeled `health`, retries until the server listens. Without the route, `curl -f` exits 22 on the
404 and both graders miss:

```text
with-background-process.eval.ts
  · with-background-process  0%  metric()
    #1  0%  succeeded:health 0%, observed:health 0%
```

If the task doesn't call `kill()`, teardown stops the server.

| File | What it is |
|---|---|
| [`with-background-process.eval.ts`](./with-background-process.eval.ts) | The eval: the prompt, the server in the background and two graders |
| [`project/`](./project) | The server the agent starts from: `server.js`, on `PORT` |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

`c.exec` and its `background` option are in the [Attempt context reference](../../docs/reference/attempt-context.mdx)
reference.
