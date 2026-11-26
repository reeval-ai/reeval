# with-framework-migration

**Shows:** a small migration, CommonJS to ES modules. The graders check `package.json` with a
`hasFile` pattern, read the task's grep for any `require(` or `module.exports` left in `src/` and
`test/` and its `npm test`, and check with `ran` that the agent ran the tests itself.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade; its script then runs `npm test` as the agent, which is what
`ran` reads. `pnpm eval --profile claude-code` runs the same eval on Claude Code, and
`--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval -v` traces the attempt: the agent's edits and its own `npm test`,
then the eval's commands and grades:

```text
[framework#1 fake] 08:13:40 harness   tool write package.json (modify)
…
[framework#1 fake] 08:13:40 harness   tool shell called: $ npm test
…
[framework#1 fake] 08:13:46 check     $ npm test → exit 0 · 3s
[framework#1 fake] 08:13:47 check     grade has-file:package.json score 1 (45ms)
[framework#1 fake] 08:13:47 check     grade succeeded:no-commonjs score 1 (29ms)
[framework#1 fake] 08:13:47 check     grade succeeded:npm test score 1 (29ms)
[framework#1 fake] 08:13:47 check     grade ran:/npm (test|t)\b|node --test/ score 1 (29ms)
```

| File | What it is |
|---|---|
| [`with-framework-migration.eval.ts`](./with-framework-migration.eval.ts) | The eval: the migration and four graders |
| [`project/`](./project) | The CommonJS package the agent starts from, with its tests |
| [`fake-agent/`](./fake-agent) | What the fake agent writes into the workspace: the package as ES modules |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

`graders` is in the [Options](../../docs/reference/options.mdx#graders) reference.
