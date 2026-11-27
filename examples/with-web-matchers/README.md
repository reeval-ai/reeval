# with-web-matchers

**Shows:** checking that the agent searched the web and read the docs, rather than answering from
memory. The agent finds the Node.js version that added `util.parseArgs()` and writes it in
`ANSWER.md`; the `searched` and `fetched` graders read the trajectory, and `hasFile` the answer.

**Needs:** a real agent and the network: `ANTHROPIC_API_KEY` in `.env.local`, Docker, and
`pnpm reeval image build` once. In this repo, run `pnpm install && pnpm build` at the root first.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** the fake agent makes no web calls, so `defaultProfile` runs this example on
Claude Code. `--profile <name>` runs it on any other agent in
[`examples/profiles.ts`](../profiles.ts) whose harness reports web events: Goose and pi report
none, and Grok Build reports searches but not fetches, so those graders fail there. A harness that
can't tell whether a turn made web calls lists them in `turn.unreported`, and both graders then
fail instead of scoring on nothing.

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the web events in the trial's `trajectory.jsonl`, from a Claude Code run,
trimmed:

```text
{"type":"web-search","query":"Node.js util.parseArgs() documentation","references":10,"ok":true,…}
{"type":"web-fetch","url":"https://nodejs.org/api/util.html","ok":true,…}
{"type":"web-fetch","url":"https://nodejs.org/api/util.html#utilparseargsconfig","ok":true,…}
```

`searched` and `fetched` count the matching events and pass at one or more.

| File | What it is |
|---|---|
| [`with-web-matchers.eval.ts`](./with-web-matchers.eval.ts) | The eval: one prompt, two web graders and the answer |
| [`reeval.config.ts`](./reeval.config.ts) | Claude Code by default, and the other agents from `../profiles.ts` |

The built-in graders are in the [Authoring API reference](../../docs/reference/authoring-api.mdx);
which harness reports which web events is in the [Choose an
agent](../../docs/configuration/agents/index.mdx) page.
