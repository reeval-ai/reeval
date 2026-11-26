# with-security-fix

**Shows:** fixing a SQL injection, checked by an exploit the agent never sees. `findUser()` builds
its query from the name it's given; the agent fixes it and the eval runs the tests, then a grader
runs a hidden exploit test against the agent's `src/` in a sandbox of its own. The exploit tries
`' OR '1'='1`, and a real name with a quote in it, so stripping quotes doesn't pass. The repo's
own tests pass on the vulnerable code, so the exploit grader is required: an attempt that
leaves the hole open scores 0.

**Needs:** Docker, where the exploit runs, even for the fake agent; in this repo, run
`pnpm install && pnpm build` at the root first. A real agent also needs its key in `.env.local`
(`ANTHROPIC_API_KEY` for Claude Code) and `pnpm reeval image build --profile claude-code` once.
The database is Node's built-in `node:sqlite`, so nothing needs `npm install`.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
graders have something to grade; here it's the fix, a bound parameter. `pnpm eval --profile claude-code`
runs the same eval on Claude Code, and `--profile <name>` on any other agent in
[`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** a fix that strips quotes from the name instead passes the tests and the
`' OR '1'='1` case, and fails on `Miles O'Brien`. The `blocks-the-exploit` grade in the run
record, under `.reeval/runs/`, names the test:

```json
{
  "grader": "blocks-the-exploit",
  "kind": "code",
  "grade": {
    "exitCode": 1,
    "failed": ["not ok 2 - a name with a quote in it still matches"]
  },
  "score": 0,
  "required": true,
  …
}
```

| File | What it is |
|---|---|
| [`with-security-fix.eval.ts`](./with-security-fix.eval.ts) | The eval: the fix, the tests, and the hidden exploit's grader |
| [`project/`](./project) | The package the agent starts from: `src/users.js` and its tests |
| [`hidden/exploit.test.js`](./hidden/exploit.test.js) | The hidden exploit test |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace: the fix |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, and the real agents from `../profiles.ts` |

`graders` is in the [Options](../../docs/reference/options.mdx#graders) reference.
