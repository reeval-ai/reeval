# with-dart

**Shows:** an official toolchain image, on this machine or on a cloud VM. The `dart` environment's
`docker({ from: 'dart:3.5' })` starts from Dart's image, which reeval builds with Node, git and the
agent. The `boat` and `daytona` profiles set `provider: boat()` or `provider: daytona()`, so the
same sandbox runs on the provider's machines: the first run builds the image into a saved snapshot
there, and later runs start from that snapshot. The agent writes `fizzbuzz.dart` and a script that
checks it, and the eval runs them with `dart`.

**Needs:** Docker, or `BOAT_API_KEY` for `--profile boat` and `DAYTONA_API_KEY` for
`--profile daytona`, even for the fake agent. `package.json` adds `@boatdev/sdk` and
`@daytona/sdk`, which `boat()` and `daytona()` load; in this repo, run
`pnpm install && pnpm build` at the root first. A real agent also needs its key in `.env.local`
(`ANTHROPIC_API_KEY` for Claude Code).

**Run:**

```bash
pnpm eval                     # in this machine's Docker
pnpm eval --profile boat      # on Boat
pnpm eval --profile daytona   # on Daytona
```

**Real or fake agent:** `pnpm eval` runs a fake agent, with no agent key. It copies the
[`fake-agent/`](./fake-agent) fixture into the workspace to mimic what an agent would produce, so the
checks have something to check; it still runs in the Dart image. `pnpm eval
--profile claude-code` runs the same eval on Claude Code, and `--profile <name>` on any other agent
in [`examples/profiles.ts`](../profiles.ts).

**Copying it out of the repo:** `reeval.config.ts` imports `../profiles.ts`. Copy
[`profiles.ts`](../profiles.ts) into the example and import it from `./profiles.ts`, or inline the
one profile you need.

**What to look at:** the cell is named after the sandbox and its image wherever it runs, and the
plan notes the provider. On Boat, the first run builds the image before any attempt starts, and a
later one starts from the saved snapshot:

```text
…
  ➜  Profile:   boat
  ➜  Harness:   fake
  ➜  Sandbox:   docker:dart:3.5
…
  ◆  Preparing 1 sandbox (docker:dart:3.5)...
  ✓  docker:dart:3.5 ready, from saved image reeval-img-c72180f4c015 3s
  images: 1 ready
  ◆  Running...

with-dart.eval.ts
PASS           writes and tests fizzbuzz in Dart
               100% passed · 1 of 1 attempt
```

`pnpm reeval image list --profile boat` shows the snapshots, and
`pnpm reeval image clean --all --profile boat` deletes them. On Boat each attempt runs in a
container of the image, so the default egress policy holds there; a Daytona sandbox keeps its own
network, so the `daytona` profile sets `egress: 'allow-all'`.

| File | What it is |
|---|---|
| [`with-dart.eval.ts`](./with-dart.eval.ts) | The eval: the Dart environment, one prompt, two checks |
| [`fake-agent/`](./fake-agent) | What the fake agent copies into the workspace |
| [`reeval.config.ts`](./reeval.config.ts) | The fake agent, the `boat` and `daytona` profiles, and the real agents from `../profiles.ts` |

Boat is in the [Run on Boat](../../docs/configuration/sandboxes/boat.mdx) page, and every
`provider`, `boat()` and `daytona()` option in the [options reference](../../docs/reference/options.mdx).
