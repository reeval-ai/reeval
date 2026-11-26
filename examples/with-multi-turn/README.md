# with-multi-turn

**Shows:** a session with a follow-up turn, graded turn by turn. The agent adds `multiply(a, b)`,
then a second `c.send` asks it to take any number of arguments. An observation made before the
second `c.send` sees the workspace as the first turn left it; one after it sees the final state.
Each of `c.turns` has its own trajectory, so the `edited-each-turn` grader calls `wrote` from
`reeval/graders/match` on one turn at a time.

**Needs:** nothing for the fake agent; in this repo, run `pnpm install && pnpm build` at the root
first. A real agent needs its key in `.env.local` (`ANTHROPIC_API_KEY` for Claude Code), Docker,
and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys or Docker. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade: `turn-1/` on the first turn and `turn-2/` on the second. `pnpm
eval --profile claude-code` runs the same eval on Claude Code, and `--profile <name>` on any other
agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** `pnpm eval -v`. Each observation prints with its value, and a grader below 1
names itself, here with the fake agent's first `multiply` adding instead:

```text
with-multi-turn.eval.ts
  · with-multi-turn  80%  metric()
    #1  80%  observed:turn-1 0%
    Observed:
      turn-1           5 1
      turn-2           24 1
      turn-2-two-args  6 1
```

The second turn still runs: the first turn's miss is a grade, not a stop.

| File | What it is |
|---|---|
| [`with-multi-turn.eval.ts`](./with-multi-turn.eval.ts) | The eval: two turns, observations after each, and the graders |
| [`checks/call.mjs`](./checks/call.mjs) | Prints a `src/math.js` function's result; placed in the sandbox's home, outside the workspace |
| [`project/`](./project) | The package the agent starts from: `src/math.js` and its test |
| [`fake-agent/`](./fake-agent) | What the fake agent writes on each turn |
| [`reeval.config.ts`](./reeval.config.ts) | The scripted fake agent, and the real agents from `../profiles.ts` |

Turns, `c.turns` and each turn's diff are in the [Read each turn](../../docs/evaluations/task/turns.mdx)
guide.
