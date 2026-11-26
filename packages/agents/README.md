# @reeval/agents

Runs coding-agent harnesses and records what they did: the trajectory, tool calls, usage and the
served model. It's private to this monorepo, and reeval's build inlines it the way it inlines the
other `@reeval/*` packages.

It runs a harness on a `Runner`: `local()` runs it on this machine, and anything with `info`,
`spawn`, `readFile`, `writeFile` and `close` can be one. `runnerSession()` turns a runner into
the sandbox session the AI SDK harness adapters drive, and `test/runner-conformance.ts` is the
suite every runner passes.

What a harness reports for each turn is typed here too: `TrajectoryEvent`, `TokenUsage`,
`TurnStatus` and `CostUsd`, with the usage arithmetic (`tokenUsage`, `addUsage`, `sumUsage`,
`promptTokens`, `totalTokens`). The arithmetic is also `@reeval/agents/usage`, which loads
nothing at run time, so it runs in any JavaScript runtime. `AgentError` is a failure of the
harness or of where it runs, with `transient` for one another try may get past.

The harness catalog's core is here as well: `HARNESSES` has each harness's credential, model
id, what it reports and its plugin rules, `LAYOUTS` where each one reads its rules, skills, MCP
config and plugins, and the `*McpServers` functions the config each CLI takes. The skill
directories are also `@reeval/agents/layouts`, which loads nothing at run time.

The routes that send a harness's model calls somewhere other than its provider's own API are
here too: `ROUTES` has Vercel AI Gateway and OpenRouter, each with the credential and model id
every harness it serves takes there and why it can't serve the rest, and `VERTEX_ROUTES` has
Vertex AI's.

`startAgent()` drives a harness: given its catalog entry, its AI SDK adapter, a model and a
runner, it starts a session over `runnerSession()` and returns one whose `send` runs a turn. Each
turn's result has its trajectory (`normalizeStream`), usage, served model and cost, and says when
the API refused the key or the model provider stopped the turn (`providerStop`). A runner whose
network sees the model calls passes their statuses and served models as `traffic`; a failure to
start is an `AgentError`.

`agent()` is the session API over it:

```ts
const a = agent({
  harness: cursor({ model: 'composer-2.5' }),
  runner: local({ cwd: './workspace' }),
  credentials: { CURSOR_API_KEY: key },
  rules: 'Run the tests before you finish.\n',
  out: './out',
})
const session = await a.start()
const turn = session.send('Fix the failing test')
for await (const event of turn.events) console.log(event.type)
const result = await turn.result
await session.close()
```

`harness` is plain data, from `cursor()`, `claudeCode()`, `antigravity()`, `opencode()`,
`goose()`, `pi()`, `codex()`, `fx()` or `grokBuild()`, and `route` sends its model calls through
Vercel AI Gateway, OpenRouter or Vertex AI instead of its provider's own API. `start()` asks the
runner where it is, writes the rules and the `workspace` skills where the harness reads them,
builds the harness's adapter (`catalogAdapter()`) from the credentials, route, model, MCP servers
and plugins, and starts the session; `exec(prompt)` does all of that for one turn. A runner from a function is the session's
own, closed with it. On a runner without a `network` (`local()`, `docker()`) the adapter
passes the key in the CLI's environment; `requireBrokering: true` refuses to instead. The install
gets pnpm with npm where the CLI's install runs it and the runner has none, and the CLIs that
download a release need `curl` and `bash` there (Node's own image has both, its `-slim` doesn't).
Claude Code, OpenCode, Goose, fx and Grok Build serve their bridge on a port the runner forwards:
publish one (`docker({ ports: [24210] })`) and name it in `session: { ports }`. With `out`, the session writes `session.json`, a line of `turns.jsonl` and
the turn's lines of `trajectory.jsonl` as each turn ends (`raw/parts.jsonl` and `debug.log` on
request), every one with the credentials' exact values masked (not encoded forms, such as base64); `schema/` has their JSON Schemas, which
`pnpm --filter reeval schema:check` holds to the types and lets change additively only.

`docker()`, from `@reeval/agents/docker`, is a runner in a plain container (`docker run -d`,
then `docker exec`), removed on `close()` unless `keep`; it has no network policy, gateway or
image builds. `install` (`auto` by default, `skip` or `always`) puts the harness's pinned CLI on
the runner as the session's `install` phase, so `agent({ runner: () => docker({ image: 'node:24',
ports: [24210] }), … })` needs nothing baked in.

It sits under reeval and knows nothing of evals or of where a harness runs:

- It imports only its own modules, `node:` builtins and the packages in its `dependencies`.
  `test/boundary.test.ts` parses every module with `oxc-parser` and refuses any other load
  (`import`, `export … from`, `import()`, `require()`, triple-slash references) and any
  specifier computed at run time. `tsconfig.json`'s `rootDir` and Biome catch the common cases
  sooner, but neither sees all of them: `reeval` resolves from here as a root devDependency.
- No exported name is an eval concept (attempts, judges, reeval's plan types, bundles, gates,
  matchers, cells, records, assertions) or an environment one (egress, brokering, gateways):
  `test/boundary.test.ts` holds that too.

```bash
pnpm --filter @reeval/agents test
pnpm --filter @reeval/agents typecheck
```

`test/contract.test.ts` is the real-agent contract: each harness's own row on its provider's key,
on `docker()` with `install: 'auto'`, checking the skill, rules, MCP call, edit and command, tool
catalog, tokens and reported model, and that no container is left. It runs with
`REEVAL_TEST_REAL=1`, each row's key and Docker (`REEVAL_CONTRACT_HARNESSES` narrows the rows),
and in `real.yml`'s pinned contract leg.
