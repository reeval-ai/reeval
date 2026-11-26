# with-egress-allow-all

**Shows:** raw TCP, which the egress gateway can't carry. Under every other policy the container's
only way out is HTTP(S) through the gateway, so SSH and database clients get no network. The eval
sets `egress: 'allow-all'`, which keeps the container's network, and the agent writes `banner.sh`,
which reads github.com's SSH banner over `/dev/tcp`.

**Needs:** Docker, even for the fake agent, and the network, with outbound port 22 open: a
network that blocks it (many corporate ones do) makes the graders miss; in this repo, run
`pnpm install && pnpm build` at the root first. A real agent also needs its key in `.env.local`
(`ANTHROPIC_API_KEY` for Claude Code) and `pnpm reeval image build --profile claude-code` once.

**Run:**

```bash
pnpm eval
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no keys. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so
the graders have something to grade. `pnpm eval --profile claude-code` runs the same eval on Claude
Code, and `--profile <name>` on any other agent in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** change the eval to `egress: 'proxy'` (the default) and `pnpm eval -v` shows
the connection fail:

```text
with-egress-allow-all.eval.ts
  · with-egress-allow-all  0%  metric()
    #1  0%  succeeded:bash banner.sh 0%, observed:banner 0%
    …
```

The attempt's `execs.jsonl` has the run's stderr: `github.com: Temporary failure in name
resolution`.

Under `'allow-all'` that traffic goes out directly, unfiltered and unrecorded, and can reach your
LAN and cloud metadata; the record marks the attempt's egress `partial`. Set it on the evals that
need it, not the config.

| File | What it is |
|---|---|
| [`with-egress-allow-all.eval.ts`](./with-egress-allow-all.eval.ts) | The eval: `egress: 'allow-all'`, one prompt, two graders |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent in Docker, and the real agents from `../profiles.ts` |

[Pass secrets](../../docs/configuration/environments/secrets.mdx) in the
Secrets and egress guide has the details.
