# with-fake-agent

**Shows:** a scripted agent for building and testing evals. `fakeAgent({ script })` takes one
list of steps per `c.send`: `exec` runs a real command in the sandbox, `write` edits files and
`reply` is the turn's final message. The task sends two turns, and the `edits-then-tests` grader
reads each with `wrote` and `ran` from `reeval/graders/match`.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs the scripted agent, with no keys or Docker. Its first turn
lists the files and writes the [`fake-agent/`](./fake-agent) fixture into the workspace; its
second runs the tests. `pnpm eval --profile claude-code` runs the same eval on Claude Code, and
`--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts), so the graders
you built against the script now grade a real agent.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the turns in `pnpm eval -v`: each script step shows as a real agent's would.

```text
[fake#1 fake] 08:10:01 harness   turn 1 started: "Add a multiply(a, b) function to src/math.js, with a test."
[fake#1 fake] 08:10:01 harness   tool shell called: $ ls src test
[fake#1 fake] 08:10:01 harness   tool shell returned exit 0 in 2ms
[fake#1 fake] 08:10:01 harness   tool write src/math.js (modify)
[fake#1 fake] 08:10:01 harness   tool write test/math.test.js (modify)
…
[fake#1 fake] 08:10:01 harness   turn 2 started: "Now run the tests and tell me whether they pass."
[fake#1 fake] 08:10:01 harness   tool shell called: $ node --test
…
[fake#1 fake] 08:10:01 check     grade edits-then-tests score 1 (1ms)
[fake#1 fake] 08:10:01 check     grade succeeded:node --test score 1 (1ms)
```

| Option | What the fake agent does |
|---|---|
| `files`, `text` | Writes these files and replies with this message on every turn |
| `failWith` | Throws before the first turn, as an infra error (exit 3) |
| `delayMs` | Waits this long per turn, honoring timeouts and Ctrl-C |
| `flakeRate` | Writes nothing in this share of attempts |
| `{ mcp: 'server/tool' }`, `{ error }` | More script steps: call a stdio MCP server's tool, end the turn with an error |

| File | What it is |
|---|---|
| [`with-fake-agent.eval.ts`](./with-fake-agent.eval.ts) | The eval: two turns, two graders |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the scripted agent writes |
| [`reeval.config.ts`](./reeval.config.ts) | The script, and the real agents from `../profiles.ts` |

Every option and step is in the [Options reference](../../docs/reference/options.mdx).
