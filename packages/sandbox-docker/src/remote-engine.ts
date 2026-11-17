import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readlinkSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { contextFiles } from './dockerignore.ts'
import {
  type ArgvTransport,
  argvTransport,
  type ExecProcess,
  hostProcess,
  type SshTarget,
  sshArgv,
} from './egress/transport.ts'
import {
  type Engine,
  engineEnv,
  engineSpec,
  isRemoteEngine,
  type LocalEngine,
  type RemoteEngine,
} from './engine.ts'
import { shellQuote as q, run, unsetOtel } from './process.ts'
import { type TarEntry, writeTar } from './tarball.ts'

/** How a command on a local engine runs on this machine. */
export type EngineCommand = {
  bin: string
  args: string[]
  /** Merged over `process.env` for the host process; the host's `OTEL_*` unset. */
  env: NodeJS.ProcessEnv
}

/**
 * The remote side of a command with an environment: its first stdin line is the base64 of the
 * `export`s, which `read` takes a byte at a time (stdin is a pipe), so the rest of stdin is the
 * CLI's own.
 */
const WITH_ENV =
  'IFS= read -r reeval_env || exit 125; reeval_env=$(printf %s "$reeval_env" | base64 -d) || exit 125; eval "$reeval_env" || exit 125; unset reeval_env; exec "$@"'

/**
 * How to run the CLI of a local engine with `args`. `env` reaches the CLI's environment, never
 * argv.
 */
export function hostCommand(
  engine: LocalEngine | undefined,
  args: readonly string[],
  env: Record<string, string> = {},
): EngineCommand {
  return {
    bin: engineSpec(engine).bin,
    args: [...args],
    env: { ...unsetOtel(), ...engineEnv(engine), ...env },
  }
}

/**
 * The command a remote engine's transport runs for the CLI with `args`. `env` goes in the
 * `preamble`, which is written to its stdin before anything else, never in argv.
 */
export function remoteCommand(
  args: readonly string[],
  env: Record<string, string> = {},
): { command: string[]; preamble: Buffer | null } {
  const names = Object.keys(env)
  for (const name of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`${name} isn't a variable name`)
  }
  const exports = names.map((name) => `export ${name}=${q(env[name] ?? '')}`).join('\n')
  return {
    command: names.length ? ['sh', '-c', WITH_ENV, 'sh', 'docker', ...args] : ['docker', ...args],
    preamble: names.length ? Buffer.from(`${Buffer.from(exports).toString('base64')}\n`) : null,
  }
}

/** Docker on `target`, its CLI run over SSH as the login user. */
export function sshEngine(
  target: SshTarget,
  description: string,
): RemoteEngine & { transport: ArgvTransport } {
  return {
    transport: argvTransport({
      argv: (command) => sshArgv(target, `exec ${command.map(q).join(' ')}`),
    }),
    description,
    unreached: (r) => isSshFailure(r, target),
    async close() {
      const [bin = 'ssh', ...args] = sshArgv(target, '')
      await run(bin, ['-O', 'exit', ...args.slice(0, -1)], { env: unsetOtel() }).catch(() => {})
    },
  }
}

/**
 * Spawns the engine's CLI with `args`, locally in its own process group, its output piped and its
 * stdin closed once the remote environment, if any, is written.
 */
export function spawnEngine(
  engine: Engine | undefined,
  args: readonly string[],
  env: Record<string, string> = {},
): ExecProcess {
  if (isRemoteEngine(engine)) {
    const { command, preamble } = remoteCommand(args, env)
    const child = engine.transport.spawn(command)
    child.stdin.on('error', () => {})
    child.stdin.end(preamble ?? undefined)
    return child
  }
  const command = hostCommand(engine, args, env)
  const child = spawn(command.bin, command.args, {
    stdio: 'pipe',
    detached: true,
    windowsHide: true,
    env: { ...process.env, ...command.env },
  })
  child.stdin.on('error', () => {})
  child.stdin.end()
  return hostProcess(child)
}

const literal = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * ssh failing to connect to `target`, so the remote CLI never ran and running it again is safe:
 * the whole of stderr is ssh's own message naming the machine. A connection that drops later
 * isn't one, since the command may have run, and nor is a remote command that printed the same.
 */
export const isSshFailure = (
  r: { exitCode: number | null; stderr: string },
  target: { host: string; port: number },
) => {
  if (r.exitCode !== 255) return false
  const at = `${literal(target.host)} port ${target.port}`
  return new RegExp(
    `^(?:ssh: connect to host ${at}: [^\\n]+|kex_exchange_identification: [^\\n]+\\n(?:Connection (?:closed|reset) by \\S+ port ${target.port}|banner exchange: Connection to \\S+ port ${target.port}: [^\\n]+)|Connection timed out during banner exchange\\nConnection to \\S+ port ${target.port} timed out)$`,
  ).test(r.stderr.trim())
}

/** Commands that run a container's process, whose output and exit code are that process's. */
const RUNS_A_PROCESS = new Set(['exec', 'run', 'start', 'attach'])

/** Whether `args` is safe to run again after ssh failed to connect. */
export const retriesSafely = (args: readonly string[]) => !RUNS_A_PROCESS.has(args[0] ?? '')

/** How traces and messages name the engine's CLI. */
export const engineLabel = (engine: Engine | undefined) =>
  isRemoteEngine(engine) ? `docker on ${engine.description}` : engineSpec(engine).bin

/** Option flags of `docker build` that take a value as the next argument. */
const BUILD_VALUE_FLAGS = new Set([
  '--add-host',
  '--allow',
  '--annotation',
  '--attest',
  '--build-arg',
  '--build-context',
  '--builder',
  '--cache-from',
  '--cache-to',
  '--call',
  '--cgroup-parent',
  '--cpu-period',
  '--cpu-quota',
  '--cpu-shares',
  '-c',
  '--cpuset-cpus',
  '--cpuset-mems',
  '--file',
  '-f',
  '--iidfile',
  '--isolation',
  '--label',
  '--memory',
  '-m',
  '--memory-swap',
  '--metadata-file',
  '--network',
  '--no-cache-filter',
  '--output',
  '-o',
  '--platform',
  '--progress',
  '--provenance',
  '--sbom',
  '--secret',
  '--security-opt',
  '--shm-size',
  '--ssh',
  '--tag',
  '-t',
  '--target',
  '--ulimit',
])

/** Whether a `docker build` flag's value names a file, directory or socket on this machine. */
function namesLocalPath(flag: string, value: string): boolean {
  switch (flag) {
    case '--iidfile':
    case '--metadata-file':
    case '--ssh':
      return true
    case '--secret':
      return !/(?:^|,)env=/.test(value)
    case '--build-context': {
      const source = value.slice(value.indexOf('=') + 1)
      return source.startsWith('oci-layout://') || !/^[a-z][a-z0-9+.-]*:\/\//.test(source)
    }
    case '--output':
    case '-o':
      return !/(?:^|,)type=/.test(value) || /(?:^|,)(?:type=(?:local|tar)|dest=)/.test(value)
    case '--cache-to':
    case '--cache-from':
      return /(?:^|,)type=local/.test(value)
    default:
      return false
  }
}

const STDIN_DOCKERFILE = '.reeval-stdin.Dockerfile'

function contextEntries(context: string, files: readonly string[]): TarEntry[] {
  const entries: TarEntry[] = []
  const dirs = new Set<string>()
  for (const path of files) {
    for (let at = path.indexOf('/'); at !== -1; at = path.indexOf('/', at + 1)) {
      dirs.add(path.slice(0, at))
    }
  }
  for (const path of [...dirs].sort()) {
    const stat = lstatSync(join(context, path))
    const mtime = Math.floor(stat.mtimeMs / 1000)
    entries.push({ type: 'dir', path, mode: stat.mode & 0o7777, mtime })
  }
  for (const path of files) {
    const full = join(context, path)
    const stat = lstatSync(full, { throwIfNoEntry: false })
    if (!stat) continue
    const mtime = Math.floor(stat.mtimeMs / 1000)
    const mode = stat.mode & 0o7777
    if (stat.isSymbolicLink()) {
      entries.push({ type: 'symlink', path, mode, mtime, target: readlinkSync(full) })
    } else if (stat.isFile()) {
      entries.push({ type: 'file', path, mode, mtime, data: readFileSync(full) })
    }
  }
  return entries
}

/**
 * `docker build` arguments and input for a remote engine: a build context on this machine goes as
 * a tar on stdin (`-`), with its `.dockerignore` rules applied by the builder as they would be
 * here. The Dockerfile keeps its path in the context; one outside it, or one read from stdin,
 * goes in the tar under a name of its own. Directories go as the files' parents, with their modes,
 * so an empty one isn't sent. The context is read into memory whole. A flag that names a path on
 * this machine (`--iidfile`, `--secret`, a local `--output`, …) is refused: the CLI would read or
 * write it on the other one. Any other command, and a build whose context is stdin, a URL or a
 * git repository, is as is.
 */
export function remoteBuild(
  args: readonly string[],
  input: Uint8Array | string | undefined,
): { args: string[]; input: Uint8Array | string | undefined } {
  if (args[0] !== 'build') return { args: [...args], input }
  let file: { at: number; value: string } | null = null
  let contextAt = -1
  for (let i = 1; i < args.length; i++) {
    const arg = args[i] as string
    const [flag = arg, joined] = arg.startsWith('--')
      ? arg.split(/=(.*)/s)
      : /^-(?:f|o)./.test(arg)
        ? [arg.slice(0, 2), arg.slice(2).replace(/^=/, '')]
        : [arg]
    const value = joined ?? args[i + 1] ?? ''
    if (namesLocalPath(flag, value)) {
      throw new Error(
        `docker build ${flag} names a path on this machine, which a remote engine can't reach`,
      )
    }
    if (BUILD_VALUE_FLAGS.has(arg)) {
      if (arg === '--file' || arg === '-f') file = { at: i + 1, value: args[i + 1] ?? '' }
      i++
    } else if (flag === '-f' && joined !== undefined) {
      file = { at: i, value: joined }
    } else if (arg.startsWith('--file=')) {
      file = { at: i, value: arg.slice('--file='.length) }
    } else if (!arg.startsWith('-') || arg === '-') {
      contextAt = i
    }
  }
  const context = contextAt === -1 ? null : (args[contextAt] as string)
  if (context === null || context === '-') return { args: [...args], input }
  if (!statSync(context, { throwIfNoEntry: false })?.isDirectory())
    return { args: [...args], input }
  const root = resolve(context)
  const out = [...args]
  out[contextAt] = '-'
  const setFile = (value: string) => {
    if (!file) out.splice(contextAt, 0, '--file', value)
    else if (out[file.at]?.startsWith('--file=')) out[file.at] = `--file=${value}`
    else if (/^-f[^-]/.test(out[file.at] ?? '') && file.at !== contextAt)
      out[file.at] = `-f${value}`
    else out[file.at] = value
  }
  const extra: TarEntry[] = []
  const now = Math.floor(Date.now() / 1000)
  // Whose `<Dockerfile>.dockerignore` decides what's sent, as the builder will.
  let dockerfile: string | null = null
  if (file?.value === '-') {
    const data = Buffer.from(input ?? '')
    extra.push({ type: 'file', path: STDIN_DOCKERFILE, mode: 0o644, mtime: now, data })
    setFile(STDIN_DOCKERFILE)
  } else {
    // The CLI reads `--file` from where it runs, not from the context.
    dockerfile = file ? resolve(file.value) : join(root, 'Dockerfile')
    const inside = relative(root, dockerfile)
    if (inside && !inside.startsWith('..') && !isAbsolute(inside)) {
      if (file) setFile(inside.split(sep).join('/'))
    } else {
      const name = `.reeval-${createHash('sha256').update(dockerfile).digest('hex').slice(0, 12)}.Dockerfile`
      extra.push({
        type: 'file',
        path: name,
        mode: 0o644,
        mtime: now,
        data: readFileSync(dockerfile),
      })
      const ignore = lstatSync(`${dockerfile}.dockerignore`, { throwIfNoEntry: false })
      if (ignore?.isFile()) {
        const data = readFileSync(`${dockerfile}.dockerignore`)
        extra.push({ type: 'file', path: `${name}.dockerignore`, mode: 0o644, mtime: now, data })
      }
      setFile(name)
    }
  }
  const files = contextFiles(root, dockerfile).filter(
    (path) => !/^\.\.(?:[\\/]|$)/.test(path) && !extra.some((e) => e.path === path),
  )
  return { args: out, input: writeTar([...contextEntries(root, files), ...extra]) }
}
