# with-guarded-files

**Shows:** failing an agent that touches files it was told to leave alone. The agent adds
`clamp(n, min, max)` to a small package with no new dependencies. A `required` `notInDiff` grader
guards `package.json` and `package-lock.json`: when either changed, the trial scores 0, however
the tests went.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade. `--profile canary` is a fake agent that does the same work but
also adds a dependency to `package.json`, from [`canary/`](./canary). `pnpm eval --profile
claude-code` runs the same eval on Claude Code, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval --profile canary -v`. The canary's `clamp` and tests are right, so
only the guard catches it, and the trial scores 0:

```text
with-guarded-files.eval.ts
  · with-guarded-files  mean 0% · 0/1 trial at 100% (pass@1)  capability(1)
    #1  0%  not-in-diff:package.json,package-lock.json 0% (required)
```

`notInDiff` reads the workspace diff, so a write from a shell command such as `npm install` counts
too. Its globs match exact paths, while `wrote`'s string matches any path containing it, so guard
with `notInDiff`.

| File | What it is |
|---|---|
| [`with-guarded-files.eval.ts`](./with-guarded-files.eval.ts) | The eval: one prompt, a test run, the guard and the tests grader |
| [`project/`](./project) | The package the agent starts from: `src/math.js`, its test, `package.json` and its lockfile |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`canary/`](./canary) | The canary's `package.json`, with a dependency added |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, the `canary` profile, and the real agents from `../profiles.ts` |

The built-in graders are in the [Authoring API reference](../../docs/reference/authoring-api.mdx).
