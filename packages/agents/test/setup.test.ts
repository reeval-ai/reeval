// setupOf(), the install modes and the marker they share with the AI SDK, on local() with a toy
// adapter whose install counts its runs, so key-free and with no Docker.
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import type { HarnessV1, HarnessV1Bootstrap } from '@ai-sdk/harness'
import { createHarnessSandboxTemplate } from '@ai-sdk/harness/agent'
import { PNPM_VERSION as BAKED_PNPM } from '@reeval/sandbox-docker'
import type { AgentKind } from '../src/catalog/entry.ts'
import { HARNESSES } from '../src/catalog/index.ts'
import { AgentError } from '../src/errors.ts'
import type { AdapterInput } from '../src/harnesses.ts'
import { local } from '../src/local.ts'
import { runnerSession } from '../src/runner-session.ts'
import { type AgentEvent, agent } from '../src/session.ts'
import { installHarness, PNPM_VERSION, recipeMarker, setupOf } from '../src/setup.ts'
import { reply, scripted } from './scripted.ts'

// Everything an install writes lands under HOME, which local() and its commands take from here.
const home = mkdtempSync(join(tmpdir(), 'reeval-agents-home-'))
process.env.HOME = home
after(() => rmSync(home, { recursive: true, force: true }))

let toys = 0
/** A recipe of its own each time, which appends a line to `runs` in `dir` whenever it runs. */
function toy(): { recipe: HarnessV1Bootstrap; adapter: HarnessV1; runs: () => number } {
  const dir = mkdtempSync(join(tmpdir(), 'reeval-agents-toy-'))
  const recipe: HarnessV1Bootstrap = {
    harnessId: `toy-${++toys}`,
    bootstrapDir: `.harness-bootstrap/toy-${toys}`,
    files: [{ path: `.harness-bootstrap/toy-${toys}/install.sh`, content: `echo ran >> runs\n` }],
    commands: [
      {
        command: `cd '${dir}' && sh "$HOME/.ai-sdk-harness/.harness-bootstrap/toy-${toys}/install.sh"`,
      },
    ],
  }
  const adapter = {
    harnessId: recipe.harnessId,
    getBootstrap: async () => recipe,
  } as unknown as HarnessV1
  const runs = () => {
    try {
      return readFileSync(join(dir, 'runs'), 'utf8').split('\n').filter(Boolean).length
    } catch {
      return 0
    }
  }
  return { recipe, adapter, runs }
}

const workspace = () => mkdtempSync(join(tmpdir(), 'reeval-agents-ws-'))

test('the marker it checks is the one the AI SDK writes', async () => {
  const { recipe, adapter, runs } = toy()
  const runner = local({ cwd: workspace() })
  const template = await createHarnessSandboxTemplate({
    harnesses: [adapter],
    sandboxConfig: { workDir: '.' },
  })
  await template?.prepare({ session: await runnerSession(runner) })
  assert.equal(runs(), 1)
  assert.notEqual(await runner.readFile(await recipeMarker(recipe, home)), null)
  await installHarness({ runner, home, adapter, name: 'Toy', mode: 'skip', workDir: '.' })
  await installHarness({ runner, home, adapter, name: 'Toy', mode: 'auto', workDir: '.' })
  assert.equal(runs(), 1, 'neither installs what the AI SDK already did')
})

test('auto installs once, always every time, and skip refuses a runner without it', async () => {
  const { adapter, runs } = toy()
  const runner = local({ cwd: workspace() })
  const install = (mode: 'auto' | 'skip' | 'always') =>
    installHarness({ runner, home, adapter, name: 'Toy', mode, workDir: '.' })
  await assert.rejects(
    install('skip'),
    (e) => e instanceof AgentError && /install is 'skip'/.test(e.message),
  )
  assert.equal(runs(), 0)
  assert.equal(await install('auto'), true)
  await install('auto')
  assert.equal(runs(), 1)
  await install('always')
  assert.equal(runs(), 2)
  assert.equal(await install('skip'), false)
  assert.equal(runs(), 2)
})

test('an adapter with nothing to install installs nothing, whatever the mode', async () => {
  const runner = local({ cwd: workspace() })
  const adapter = { harnessId: 'bare' } as unknown as HarnessV1
  for (const mode of ['auto', 'skip', 'always'] as const) {
    assert.equal(
      await installHarness({ runner, home, adapter, name: 'Bare', mode, workDir: '.' }),
      false,
    )
  }
})

test('a session times its install as a phase, before the harness starts', async () => {
  const { adapter: install, runs } = toy()
  const script = scripted([reply('done')])
  const harness = {
    harness: script.options.harness,
    adapter: async (input: AdapterInput) =>
      Object.assign(Object.create(await script.options.adapter(input)), {
        getBootstrap: install.getBootstrap,
      }) as HarnessV1,
  }
  const out = workspace()
  const events: AgentEvent[] = []
  const session = await agent({
    ...harness,
    runner: local({ cwd: workspace() }),
    out,
    onEvent: (e) => events.push(e),
  }).start()
  await session.close()
  assert.equal(runs(), 1)
  const phases = events.flatMap((e) => (e.type === 'phase' ? [e.phase] : []))
  assert.deepEqual(phases, ['runner', 'place', 'install', 'bootstrap', 'ready', 'closed'])
  const doc = JSON.parse(readFileSync(join(out, 'session.json'), 'utf8'))
  assert.equal(typeof doc.phases.install, 'number')

  const skipped = await agent({
    ...harness,
    runner: local({ cwd: workspace() }),
    install: 'skip',
  }).start()
  await skipped.close()
  assert.equal(runs(), 1, 'skip found it installed')
})

test("a session with install: 'skip' fails to start on a runner without the CLI", async () => {
  const { adapter: install, runs } = toy()
  const script = scripted([])
  const harness = {
    harness: script.options.harness,
    adapter: async (input: AdapterInput) =>
      Object.assign(Object.create(await script.options.adapter(input)), {
        getBootstrap: install.getBootstrap,
      }) as HarnessV1,
  }
  await assert.rejects(
    agent({ ...harness, runner: local({ cwd: workspace() }), install: 'skip' }).start(),
    /doesn't have this build of the Cursor CLI installed/,
  )
  assert.equal(runs(), 0)
  assert.deepEqual(script.calls, [], 'the harness never started')
})

test("a failed install or runner probe fails the start with an AgentError, keeping the cause's transient", async () => {
  const script = scripted([])
  const failing = (commands: HarnessV1Bootstrap['commands']) => ({
    harness: script.options.harness,
    adapter: async (input: AdapterInput) =>
      Object.assign(Object.create(await script.options.adapter(input)), {
        getBootstrap: async () => ({
          harnessId: `failing-${++toys}`,
          bootstrapDir: `.harness-bootstrap/failing-${toys}`,
          files: [],
          commands,
        }),
      }) as HarnessV1,
  })
  const install = await agent({
    ...failing([{ command: 'echo no network >&2; exit 7' }]),
    runner: local({ cwd: workspace() }),
  })
    .start()
    .then(
      () => assert.fail('the start succeeded'),
      (error: unknown) => error,
    )
  assert.ok(install instanceof AgentError, String(install))
  assert.match(install.message, /^Cursor harness failed to start: /)
  assert.equal(install.transient, false)
  assert.deepEqual(script.calls, [], 'the harness never started')

  const runner = local({ cwd: workspace() })
  const probe = await agent({
    ...failing([]),
    runner: {
      ...runner,
      info: async () => {
        throw Object.assign(new Error('uname: connection reset'), { transient: true })
      },
    },
  })
    .start()
    .then(
      () => assert.fail('the start succeeded'),
      (error: unknown) => error,
    )
  await runner.close()
  assert.ok(probe instanceof AgentError, String(probe))
  assert.equal(probe.message, 'Cursor harness failed to start: uname: connection reset')
  assert.equal(probe.transient, true)
})

test('setupOf names each harness, its credentials and an install recipe', async () => {
  for (const kind of Object.keys(HARNESSES) as AgentKind[]) {
    const setup = setupOf(kind)
    assert.equal(setup.name, HARNESSES[kind].name)
    assert.ok(setup.cli, kind)
    assert.deepEqual(setup.platforms, HARNESSES[kind].platforms)
    const recipe = await setup.recipe()
    assert.ok(
      recipe && recipe.commands.length + recipe.files.length > 0,
      `${kind} installs something`,
    )
  }
  assert.deepEqual(setupOf('claude-code').credentials, [
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
  ])
  assert.deepEqual(setupOf('codex').credentials, ['OPENAI_API_KEY'])
  assert.deepEqual(setupOf('pi').credentials, [], "pi's key is its model's provider's")
})

test("a runner without pnpm gets the images' pnpm before an install that runs it", async () => {
  assert.equal(PNPM_VERSION, BAKED_PNPM)
  const bin = mkdtempSync(join(tmpdir(), 'reeval-agents-bin-'))
  // npm, on a PATH with no pnpm: it logs its arguments and leaves a pnpm that logs its own.
  writeFileSync(
    join(bin, 'npm'),
    `#!/bin/sh\necho "npm $*" >> "${bin}/log"\nprintf '#!/bin/sh\\necho "pnpm $*" >> "${bin}/log"\\n' > "${bin}/pnpm"\nchmod +x "${bin}/pnpm"\n`,
  )
  chmodSync(join(bin, 'npm'), 0o755)
  const recipe: HarnessV1Bootstrap = {
    harnessId: 'toy-pnpm',
    bootstrapDir: '.harness-bootstrap/toy-pnpm',
    files: [{ path: '.harness-bootstrap/toy-pnpm/package.json', content: '{}' }],
    commands: [{ command: 'pnpm install --frozen-lockfile' }],
  }
  const adapter = {
    harnessId: 'toy-pnpm',
    getBootstrap: async () => recipe,
  } as unknown as HarnessV1
  const runner = local({ cwd: workspace(), env: { PATH: `${bin}:/usr/bin:/bin` } })
  mkdirSync(join(home, '.ai-sdk-harness'), { recursive: true })
  const install = () =>
    installHarness({ runner, home, adapter, name: 'Toy', mode: 'always', workDir: '.' })
  assert.equal(await install(), true)
  assert.equal(await install(), true)
  rmSync(join(bin, 'pnpm'))
  // Installed already: `auto` runs neither npm nor the recipe, pnpm or not.
  await installHarness({ runner, home, adapter, name: 'Toy', mode: 'auto', workDir: '.' })
  await runner.close()
  assert.deepEqual(readFileSync(join(bin, 'log'), 'utf8').trim().split('\n'), [
    `npm install --global --no-fund --no-audit pnpm@${PNPM_VERSION}`,
    'pnpm install --frozen-lockfile',
    'pnpm install --frozen-lockfile',
  ])
})
