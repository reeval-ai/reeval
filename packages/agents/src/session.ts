import { posix } from 'node:path'
import type { HarnessV1 } from '@ai-sdk/harness'
import type { HarnessCatalogEntry } from './catalog/entry.ts'
import { HARNESSES } from './catalog/index.ts'
import { agentMcp, LAYOUTS } from './catalog/layouts.ts'
import { type ModelTraffic, REFUSED_KEY, startAgent } from './driver/agent.ts'
import { errorText, type StampedPart } from './driver/trajectory.ts'
import type { AgentLog, HarnessResult, HarnessSession } from './driver/types.ts'
import { AgentError } from './errors.ts'
import {
  type AdapterContext,
  type AdapterInput,
  type AgentRoute,
  catalogAdapter,
  type HarnessSpec,
} from './harnesses.ts'
import { optionProblem } from './options.ts'
import { type OutOptions, OutWriter } from './out/index.ts'
import type { OutSession } from './out/types.ts'
import { ROUTES } from './routes/index.ts'
import type { RouteConfig } from './routes/route.ts'
import { VERTEX_ROUTES } from './routes/vertex.ts'
import type { Runner, RunnerInfo } from './runner.ts'
import type { RunnerSessionOptions } from './runner-session.ts'
import { type InstallMode, installHarness } from './setup.ts'
import type { PlacedPlugin, ResolvedMcpServer } from './spec.ts'
import type { TrajectoryEvent } from './types.ts'
import { AGENTS_VERSION } from './version.ts'

/** A skill the session places for the agent: `SKILL.md` and its other files. */
export type AgentSkill = {
  name: string
  description: string
  /** `SKILL.md`'s body, under the frontmatter the session writes. */
  content: string
  files?: Array<{ path: string; content: string }>
  /**
   * `harness` (the default) hands it to the adapter, which places it where the agent reads its
   * own skills; `workspace` writes it into the workspace's skill directory.
   */
  placement?: 'harness' | 'workspace'
}

/** A start-up phase, or the session closing, with the milliseconds it took. */
export type AgentPhase = 'runner' | 'place' | 'install' | 'bootstrap' | 'ready' | 'closed'

/**
 * What a session reports as it goes. A turn's `part` events arrive as the harness streams them
 * (only with `parts: true`); its `trajectory` events once the turn ends, normalized.
 */
export type AgentEvent =
  | { type: 'phase'; phase: AgentPhase; ms: number }
  | { type: 'turn-start'; turn: number; prompt: string }
  | { type: 'part'; turn: number; part: StampedPart }
  | { type: 'trajectory'; turn: number; event: TrajectoryEvent }
  | { type: 'warning'; message: string }
  | { type: 'turn-end'; turn: number; result: HarnessResult }

export type AgentOptions = {
  harness: HarnessSpec
  /** Where the harness's model calls go; its provider's own API by default. */
  route?: AgentRoute
  /**
   * Where the agent's CLI runs. A function's runner is the session's own, closed when the session
   * closes; a runner passed as is stays open for the caller.
   */
  runner: Runner | (() => Runner | Promise<Runner>)
  /** The credentials the adapter authenticates with, by variable; read again on each start. */
  credentials?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>)
  /**
   * Whether `start()` installs the harness's CLI on the runner, as its own `install` phase:
   * `auto` (the default) when the runner doesn't have this build of it yet.
   */
  install?: InstallMode
  /** The agent's workspace, relative to the runner's `cwd`; the `cwd` itself by default. */
  workDir?: string
  /** Written to the workspace file the harness reads rules from (`AGENTS.md`, `CLAUDE.md`). */
  rules?: string
  skills?: readonly AgentSkill[]
  mcp?: Record<string, ResolvedMcpServer>
  /**
   * Plugins already on the runner, each at `dir`, which the adapter makes its agent load. An
   * agent that loads a plugin's own MCP config starts its `servers` from there, not from `mcp`.
   */
  plugins?: readonly PlacedPlugin[]
  /** The host environment a route's URLs and OpenCode's provider are read from; `process.env` by default. */
  env?: NodeJS.ProcessEnv
  /** A gateway model's limits, for pi on a gateway that doesn't describe the model. */
  describeModel?: AdapterContext['describeModel']
  /** The fetch the adapter's own calls from the host go through; the global one by default. */
  fetch?: AdapterContext['fetch']
  /**
   * Refuse to start when the runner's network can't broker the harness's key; true by default
   * for a runner with a `network`. Without it, the key goes in the CLI's environment.
   */
  requireBrokering?: boolean
  /** Builds the harness's AI SDK adapter in place of the catalog's, such as a test's scripted one. */
  adapter?: (input: AdapterInput) => HarnessV1 | Promise<HarnessV1>
  /** What the session the adapter drives says of itself: its id, description and ports. */
  session?: RunnerSessionOptions
  /** Where the runner's network saw the agent's model calls, which say a turn was refused. */
  traffic?: ModelTraffic
  /** Paths under it in the trajectory are made relative to the workspace. */
  workspace?: RegExp
  /** Keep every stream part on each turn's result, as `raw`; `out`'s `raw` does too. */
  raw?: boolean
  /**
   * What a turn's error says when it may be a refused key (`refused` when a model call got a
   * 401), or undefined to leave it; by default it names the credentials.
   */
  authHint?: (message: string, refused: boolean) => string | undefined
  /** Where on the host to write what the session did. */
  out?: string | OutOptions
  /** Every event, the session's and its turns'. */
  onEvent?: (event: AgentEvent) => void
  /** Report each stream part as a `part` event. */
  parts?: boolean
  /** Where the harness reports what it does. */
  log?: AgentLog
  /** Aborting it stops the session starting, and any turn. */
  signal?: AbortSignal
  /**
   * How long `close()` waits for a turn that ignores its abort, and then for the harness session
   * to close, before it ends the turn `aborted` and closes the runner anyway; 10 seconds by
   * default, and at most 2³¹ − 1 ms (`Infinity` is that). A turn ended this way has only the
   * timeout's error in its trajectory: what it streamed before is in `raw/parts.jsonl` alone.
   */
  closeTimeoutMs?: number
}

/** The route's configuration for the harness; undefined on its provider's own API. */
function routeConfig(
  harness: HarnessSpec,
  route: AgentRoute,
  entry: HarnessCatalogEntry,
  env: NodeJS.ProcessEnv,
): RouteConfig | undefined {
  if (route.kind === 'direct') return undefined
  const config =
    route.kind === 'vertex'
      ? VERTEX_ROUTES[harness.kind]
      : ROUTES[route.kind].routes[harness.kind]?.(env)
  if (!config) {
    const name = route.kind === 'vertex' ? 'Vertex AI' : ROUTES[route.kind].name
    throw new AgentError(`The ${entry.name} harness doesn't run on ${name}`)
  }
  return config
}

/** A turn in flight: its events as they happen, and its result. */
export type AgentTurn = {
  /** For one reader: a second `for await` takes events from the first. */
  events: AsyncIterable<AgentEvent>
  result: Promise<HarnessResult>
}

/** One agent conversation. */
export type AgentSession = {
  /** Starts the next turn; refused while one is running. */
  send(prompt: string, options?: { signal?: AbortSignal }): AgentTurn
  /**
   * Ends the running turn as far as it got, for a turn that didn't stop when aborted: what the
   * agent streamed, with `note` (why) last, and the usage its CLI stored. `close()` doesn't wait
   * for it after that.
   */
  stopped(note: TrajectoryEvent): Promise<HarnessResult>
  /**
   * Reads the usage the running turn's CLI stored so far, for the turn's result: call it when the
   * run is cut off, before the runner goes away.
   */
  salvage(): Promise<void>
  /**
   * Aborts a running turn, closes the harness session, then the runner when the session owns it.
   * A turn or session that doesn't stop within `closeTimeoutMs` is left behind. Idempotent.
   */
  close(): Promise<void>
}

export type Agent = {
  start(): Promise<AgentSession>
  /** Starts a session, runs one turn and closes it. */
  exec(prompt: string, options?: { signal?: AbortSignal }): Promise<HarnessResult>
}

/** Events pushed in one place and read with `for await` in another, ending on `end()`. */
function channel<T>() {
  const buffered: T[] = []
  let waiting: ((r: IteratorResult<T>) => void) | undefined
  let ended = false
  return {
    push(value: T) {
      if (waiting) {
        waiting({ value, done: false })
        waiting = undefined
      } else buffered.push(value)
    },
    end() {
      ended = true
      waiting?.({ value: undefined, done: true })
      waiting = undefined
    },
    iterable: {
      [Symbol.asyncIterator]: (): AsyncIterator<T> => ({
        next: () => {
          const value = buffered.shift()
          if (value !== undefined) return Promise.resolve({ value, done: false })
          if (ended) return Promise.resolve({ value: undefined, done: true })
          return new Promise((resolve) => {
            waiting = resolve
          })
        },
      }),
    } as AsyncIterable<T>,
  }
}

const skillMd = (skill: AgentSkill) =>
  `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n${skill.content}`

/** One path segment of at most 128 characters, not ending in `.`: a skill's directory name. */
const SKILL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9_-])?$/

/** Refuses a skill whose name or files would land outside its own directory. */
function checkSkills(skills: readonly AgentSkill[]) {
  for (const skill of skills) {
    if (!SKILL_NAME.test(skill.name)) {
      throw new AgentError(
        `The skill name ${JSON.stringify(skill.name)} isn't one path segment of at most 128 letters, digits, '.', '_' or '-', ending in no '.'`,
      )
    }
    for (const f of skill.files ?? []) {
      const segments = f.path.split('/')
      const unsafe =
        /[\\\0]/.test(f.path) ||
        f.path.startsWith('/') ||
        segments.some((s) => s === '' || s === '..' || s.endsWith('.') || s.length > 255)
      if (unsafe) {
        throw new AgentError(
          `The skill ${skill.name}'s file ${JSON.stringify(f.path)} isn't a relative path inside it, with no '\\', NUL, empty segment or segment ending in '.'`,
        )
      }
    }
  }
}

/** How long `close()` waits on each step of a turn or session that doesn't stop, by default. */
const CLOSE_TIMEOUT_MS = 10_000
/** The longest `setTimeout` takes; past it, Node fires at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1

const closeTimeoutOf = (ms: number | undefined) =>
  ms === undefined || Number.isNaN(ms)
    ? CLOSE_TIMEOUT_MS
    : Math.min(Math.max(ms, 0), MAX_TIMEOUT_MS)

/** A write that fails on the path it was given (too long, a NUL) as the skill's fault. */
async function placing(skill: string, write: () => Promise<void>) {
  try {
    await write()
  } catch (error) {
    const code = (error as { code?: unknown }).code
    if (
      code === 'ENAMETOOLONG' ||
      code === 'ERR_INVALID_ARG_VALUE' ||
      code === 'ERR_INVALID_ARG_TYPE'
    ) {
      throw new AgentError(`Couldn't place the skill ${skill}: ${errorText(error)}`)
    }
    throw error
  }
}

/** `promise`'s value, or undefined once `ms` have passed without it settling. */
async function within<T>(promise: PromiseLike<T>, ms: number): Promise<{ value: T } | undefined> {
  let late: (value: undefined) => void = () => {}
  const lateness = new Promise<undefined>((resolve) => {
    late = resolve
  })
  const timer = setTimeout(() => late(undefined), ms)
  try {
    return await Promise.race([Promise.resolve(promise).then((value) => ({ value })), lateness])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A coding agent on a runner. `start()` asks the runner where it is, places the rules and skills,
 * builds the adapter and starts the harness's session; each `send` is a turn.
 */
export function agent(options: AgentOptions): Agent {
  const { harness } = options
  const unsupported = optionProblem(harness.kind, harness)
  if (unsupported) throw new AgentError(unsupported)
  const entry: HarnessCatalogEntry = HARNESSES[harness.kind]
  const layout = LAYOUTS[harness.kind]
  const workDir = options.workDir ?? '.'
  const outOptions = typeof options.out === 'string' ? { dir: options.out } : options.out
  const route = options.route ?? { kind: 'direct' }
  const env = options.env ?? process.env
  const plugins = options.plugins ?? []
  const closeTimeout = closeTimeoutOf(options.closeTimeoutMs)
  const emit = (event: AgentEvent) => {
    try {
      options.onEvent?.(event)
    } catch {}
  }

  async function start(): Promise<AgentSession> {
    const owned = typeof options.runner === 'function'
    const signal = options.signal ?? new AbortController().signal
    let out: OutWriter | undefined
    const warn = (message: string) => emit({ type: 'warning', message })
    const writing = (write: Promise<void> | undefined) =>
      write?.catch((error) => warn(`writing ${out?.dir}: ${errorText(error)}`))
    const log: AgentLog = {
      log: (phase, text) => {
        options.log?.log(phase, text)
        void writing(out?.log(`[${phase}] ${text}`))
      },
      trace: (phase, kind, data, show) => options.log?.trace(phase, kind, data, show),
    }
    const doc: OutSession = {
      schemaVersion: 1,
      agentsVersion: AGENTS_VERSION,
      harness: {
        kind: harness.kind,
        model: harness.model,
        ...(harness.effort ? { effort: harness.effort } : {}),
      },
      startedAt: new Date().toISOString(),
      phases: {},
      status: 'running',
    }
    const phase = (name: AgentPhase, since: number) => {
      const ms = Date.now() - since
      if (name !== 'ready' && name !== 'closed') doc.phases[name] = ms
      emit({ type: 'phase', phase: name, ms })
    }
    let credentials: Record<string, string> = {}
    let runner: Runner | undefined
    let session: HarnessSession
    let onPart: ((part: StampedPart) => void) | undefined
    const begun = Date.now()
    try {
      const skills = options.skills ?? []
      checkSkills(skills)
      credentials =
        typeof options.credentials === 'function'
          ? await options.credentials()
          : (options.credentials ?? {})
      if (outOptions) out = await OutWriter.open(outOptions, Object.values(credentials))
      runner = typeof options.runner === 'function' ? await options.runner() : options.runner
      const box = runner
      const names = Object.keys(credentials)
      const variable = names.length ? names.join(' or ') : (entry.credential ?? 'its credential')
      const authHint =
        options.authHint ??
        ((message: string, refused: boolean) =>
          refused || REFUSED_KEY.test(message)
            ? `The API rejected ${variable} for the ${entry.name} harness`
            : undefined)
      const starting = async <T>(step: () => Promise<T>): Promise<T> => {
        try {
          return await step()
        } catch (error) {
          if (error instanceof AgentError || signal.aborted) throw error
          const message = errorText(error)
          const hint = authHint(message, options.traffic?.statuses().includes(401) ?? false)
          throw new AgentError(
            `${hint ? `${hint}. ` : ''}${entry.name} harness failed to start: ${message}`,
            { transient: !hint && (error as { transient?: unknown }).transient === true },
          )
        }
      }
      let since = Date.now()
      const info: RunnerInfo = await starting(() => box.info())
      doc.runner = info
      phase('runner', since)
      await writing(out?.session(doc))

      since = Date.now()
      if (options.rules !== undefined) {
        await box.writeFile(posix.join(workDir, layout.rulesFile), options.rules)
      }
      for (const skill of skills.filter((s) => s.placement === 'workspace')) {
        const dir = posix.join(workDir, layout.workspaceSkillDir, skill.name)
        await placing(skill.name, () => box.writeFile(`${dir}/SKILL.md`, skillMd(skill)))
        for (const f of skill.files ?? []) {
          await placing(skill.name, () => box.writeFile(`${dir}/${f.path}`, f.content))
        }
      }
      phase('place', since)

      since = Date.now()
      const routed = routeConfig(harness, route, entry, env)
      const model = (routed?.modelId ?? entry.modelId)?.(harness.model) ?? harness.model
      const mcp = agentMcp(layout, options.mcp ?? {}, plugins)
      const input: AdapterInput = {
        auth: credentials,
        model,
        ...(harness.effort ? { effort: harness.effort } : {}),
        ...(Object.keys(mcp).length ? { mcpServers: entry.mcpServers(mcp) } : {}),
        requireBrokering: options.requireBrokering ?? box.network !== undefined,
      }
      const adapter = options.adapter
        ? await options.adapter(input)
        : await catalogAdapter({
            ...input,
            harness,
            route,
            plugins,
            env,
            ...(options.describeModel ? { describeModel: options.describeModel } : {}),
            ...(options.fetch ? { fetch: options.fetch } : {}),
          })
      doc.adapter = { name: adapter.harnessId }
      const installed = await starting(() =>
        installHarness({
          runner: box,
          home: info.home,
          adapter,
          name: entry.name,
          mode: options.install ?? 'auto',
          workDir,
          signal,
        }),
      )
      if (installed) {
        phase('install', since)
        since = Date.now()
      }
      session = await startAgent({
        kind: harness.kind,
        entry,
        adapter,
        model,
        runner: box,
        ...(options.session ? { session: options.session } : {}),
        workDir,
        skills: skills
          .filter((s) => s.placement !== 'workspace')
          .map((s) => ({
            name: s.name,
            description: s.description,
            content: s.content,
            files: s.files ?? [],
          })),
        signal,
        log,
        ...(harness.instructions !== undefined ? { instructions: harness.instructions } : {}),
        ...(harness.tools ? { tools: harness.tools } : {}),
        ...(options.traffic ? { traffic: options.traffic } : {}),
        authHint,
        ...(options.workspace ? { workspace: options.workspace } : {}),
        ...(options.raw || outOptions?.raw ? { raw: true } : {}),
        onPart: (part) => onPart?.(part),
      })
      phase('bootstrap', since)
    } catch (error) {
      if (outOptions && !out) {
        out = await OutWriter.open(outOptions, Object.values(credentials)).catch(() => undefined)
      }
      doc.status = 'failed'
      doc.error = errorText(error)
      doc.endedAt = new Date().toISOString()
      await writing(out?.session(doc))
      await writing(out?.flush())
      if (owned) await runner?.close().catch(() => {})
      throw error
    }
    const box = runner as Runner
    await writing(out?.session(doc))
    emit({ type: 'phase', phase: 'ready', ms: Date.now() - begun })

    const closed = new AbortController()
    let turns = 0
    let running:
      | { done: Promise<unknown>; force: (result: HarnessResult) => void; startedAt: number }
      | undefined
    let closing: Promise<void> | undefined

    return {
      send(prompt, sendOptions = {}) {
        if (closing) throw new AgentError('The session is closed')
        if (running) throw new AgentError('A turn is already running in this session')
        const turn = turns++
        const events = channel<AgentEvent>()
        const report = (event: AgentEvent) => {
          events.push(event)
          emit(event)
        }
        const turnSignal = AbortSignal.any(
          [signal, closed.signal, sendOptions.signal].filter(
            (s): s is AbortSignal => s !== undefined,
          ),
        )
        onPart = (part) => {
          out?.part(turn, part)
          if (options.parts) report({ type: 'part', turn, part })
        }
        let force: (result: HarnessResult) => void = () => {}
        const forced = new Promise<HarnessResult>((resolve) => {
          force = resolve
        })
        report({ type: 'turn-start', turn, prompt })
        const result = (async () => {
          try {
            const result = await Promise.race([session.send(prompt, turnSignal), forced])
            for (const event of result.trajectory) report({ type: 'trajectory', turn, event })
            await writing(out?.parts(turn))
            await writing(out?.turn(turn, prompt, result))
            report({ type: 'turn-end', turn, result })
            return result
          } finally {
            await writing(out?.parts(turn))
            onPart = undefined
            running = undefined
            events.end()
          }
        })()
        running = { done: result.catch(() => {}), force, startedAt: Date.now() }
        return { events: events.iterable, result }
      },
      async stopped(note) {
        const turn = running
        if (!turn || !session.stopped) throw new AgentError('No turn is running')
        const result = await session.stopped(note)
        turn.force(result)
        await turn.done
        return result
      },
      salvage: () => session.salvage?.() ?? Promise.resolve(),
      close() {
        closing ??= (async () => {
          const since = Date.now()
          closed.abort()
          const turn = running
          if (turn && !(await within(turn.done, closeTimeout))) {
            const atMs = Date.now() - turn.startedAt
            const message = `The turn didn't stop within ${closeTimeout}ms of the session closing`
            warn(message)
            turn.force({
              text: '',
              status: 'aborted',
              startedAt: new Date(turn.startedAt).toISOString(),
              durationMs: atMs,
              trajectory: [{ type: 'error', message, ts: new Date().toISOString(), atMs }],
              usage: null,
              model: null,
              unreported: [],
            })
            await turn.done
          }
          if (!(await within(session.close(), closeTimeout))) {
            warn(`The ${entry.name} session didn't close within ${closeTimeout}ms`)
          }
          if (owned) await box.close().catch(() => {})
          doc.status = 'closed'
          doc.endedAt = new Date().toISOString()
          await writing(out?.session(doc))
          await writing(out?.flush())
          phase('closed', since)
        })()
        return closing
      },
    }
  }

  return {
    start,
    async exec(prompt, execOptions) {
      const session = await start()
      try {
        return await session.send(prompt, execOptions).result
      } finally {
        await session.close()
      }
    },
  }
}
