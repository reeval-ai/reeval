// `reeval run` on a terminal runs its engine in a background process of its own (`REEVAL_ENGINE`),
// in its own session, so a closed terminal or a detached viewer leaves the run going. The engine
// says over IPC which stream it writes, then drops the channel; what it prints outside that stream
// goes to `.reeval/events/<run>.log`, which the viewer prints once the run ends.
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { constants } from 'node:os'
import { join } from 'node:path'
import { DIST_DIR, reevalCommand } from './root.ts'

/** Set in the engine's environment, which `reeval run` there takes as being the engine. */
export const ENGINE_ENV = 'REEVAL_ENGINE'

/** What the engine sends once its event stream is open. */
export type EngineReady = { runId: string; events: string; from: number }

export type Engine = EngineReady & {
  /** The engine's exit code once it has exited, or a signal's as a shell reports it. */
  exited: Promise<number>
  /** Writes what the engine printed since the last call. */
  relay: () => void
  /** Leaves the engine running when this process exits. */
  leave: () => void
  /** Removes the engine's log, once it's been relayed whole. */
  forget: () => void
}

/**
 * Starts `reeval <argv>` as the engine of a run in `root`, and resolves once its stream is open; with
 * the engine's exit code when it ended before that, having relayed what it printed.
 */
export async function startEngine(
  root: string,
  argv: readonly string[],
  write: (text: string) => void,
): Promise<Engine | number> {
  const dir = join(root, '.reeval', 'events')
  mkdirSync(dir, { recursive: true })
  let log = join(dir, `engine-${process.pid}.log`)
  const fd = openSync(log, 'w')
  const [command, ...args] = reevalCommand(join(DIST_DIR, 'cli.js'), argv, process.execArgv)
  const child = spawn(command, args, {
    detached: true,
    stdio: ['ignore', fd, fd, 'ipc'],
    env: { ...process.env, [ENGINE_ENV]: '1' },
    serialization: 'json',
  })
  closeSync(fd)
  const exited = new Promise<number>((resolve) => {
    child.once('exit', (code, signal) =>
      resolve(code ?? 128 + (signal ? constants.signals[signal] : 0)),
    )
  })
  let shown = 0
  const relay = () => {
    const text = readFileSync(log)
    if (text.length > shown) write(text.subarray(shown).toString())
    shown = text.length
  }
  // A Ctrl-C before the run's viewer is up reaches the engine as it would in this terminal.
  const forward = () => {
    if (child.pid) process.kill(-child.pid, 'SIGINT')
  }
  process.on('SIGINT', forward)
  process.on('SIGTERM', forward)
  const ready = await new Promise<EngineReady | null>((resolve) => {
    child.once('message', (m) => resolve(m as EngineReady))
    child.once('exit', () => resolve(null))
  }).finally(() => {
    process.off('SIGINT', forward)
    process.off('SIGTERM', forward)
  })
  if (!ready) {
    const code = await exited
    relay()
    rmSync(log, { force: true })
    return code
  }
  const named = join(dir, `${ready.runId}.log`)
  renameSync(log, named)
  log = named
  relay()
  return {
    ...ready,
    exited,
    relay,
    leave: () => {
      if (child.connected) child.disconnect()
      child.unref()
    },
    forget: () => rmSync(log, { force: true }),
  }
}
