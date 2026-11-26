# with-existing-codebase

**Shows:** a feature-sized task on a real repository. The workspace is
[sindresorhus/camelcase](https://github.com/sindresorhus/camelcase) at its `v10.0.0` tag, fetched
with `git(repo, { ref, init: true })`, so the agent sees a git checkout. The agent adds a
`separators` option; the eval runs the repository's own tests, and its graders check them and
the readme and run a hidden test of the option in a sandbox of their own. The hidden test is
required, since the repository's tests pass without the option.

**Needs:** the network, for reeval to fetch the repository on the host (it caches the tree in
`.reeval/cache/`), and Docker, where the hidden test runs, even for the fake agent; in this repo,
run `pnpm install && pnpm build` at the root first. A real agent also needs its key in
`.env.local` (`ANTHROPIC_API_KEY` for Claude Code) and
`pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade; here that's a patch, which its script applies with `git apply`
before running the tests. `pnpm eval --profile claude-code` runs the same eval on Claude Code, and
`--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).

camelcase has no dependencies and its tests run on `node --test`, so nothing needs `npm install`.
For a repository that does, add `setup: [{ run: 'npm ci', timeout: '5m' }]` to the environment;
the diff starts after it.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval -v` traces the attempt, from the pinned checkout to the hidden
test:

```text
[existing#1 fake] 08:18:09 env       workspace github:sindresorhus/camelcase#v10.0.0 at 328428291b2f (92160 bytes of tar, with a .git) in 20ms
[existing#1 fake] 08:18:09 env       workspace snapshot taken: the diff starts here
…
[existing#1 fake] 08:18:09 harness   tool shell called: $ git apply separators.patch && rm separators.patch
…
[existing#1 fake] 08:18:10 check     $ node --test → exit 0 · 334ms
[existing#1 fake] 08:18:12 check     grade succeeded:node --test score 1 (4ms)
[existing#1 fake] 08:18:12 check     grade has-file:readme.md score 1 (9ms)
[existing#1 fake] 08:18:12 check     grade separators-work score 1 (2031ms)
```

| File | What it is |
|---|---|
| [`with-existing-codebase.eval.ts`](./with-existing-codebase.eval.ts) | The eval: the pinned repository, the task and three graders |
| [`hidden/separators.test.js`](./hidden/separators.test.js) | The hidden test of the new option |
| [`fake-agent/`](./fake-agent) | What the fake agent applies to the checkout: `separators.patch` |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

The [Start from a repository](../../docs/configuration/environments/repositories.mdx) page covers
`path`, private repositories and what the record keeps.
