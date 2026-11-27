// Out-of-process eval files: declaration tree over the runner session, bodies over trial protocol v2.
import { AsyncLocalStorage } from 'node:async_hooks'
import { relative } from 'node:path'
import { trialForContext } from '../trial/state.ts'
import type { TrialDone } from '../contract/trial.ts'
import { UsageError } from '../errors.ts'
import { declareTree } from '../evaluate.ts'
import { InfraError } from '../sandbox/types.ts'
import type { BackgroundHandle, EvalFn } from '../types.ts'
import { adapterForFile, runnerEnv } from './adapter.ts'
import { replyToTrial } from './trial-host.ts'
import type { RunnerTrialRequest, RunnerTrialStart } from './protocol.ts'
import {
  errorFrom,
  isRunnerTrialDone,
  isRunnerTrialRequest,
  isSessionFrom,
  type LanguageRunner,
  RunnerLoadError,
  startLanguageRunner,
} from './transport.ts'

type Live = {
  onRequest(message: RunnerTrialRequest): void
  onLog(message: Extract<import('./protocol.ts').SessionFromRunner, { t: 'log' }>): void
  onDone(message: TrialDone): void
  gone(reason: string): void
}

const runners = new Map<string, LanguageRunner>()

export async function collectLanguageFile(file: string, root: string): Promise<void> {
  const adapter = adapterForFile(file)
  if (!adapter.remote) throw new Error(`${adapter.id} evals load in-process`)
  const rel = relative(root, file).replaceAll('\\', '/')
  let runner = runners.get(root)
  if (!runner) {
    const command = adapter.runnerCommand(root)
    runner = await startLanguageRunner(command, root, runnerEnv(root, adapter)).catch((error) => {
      if (!(error instanceof RunnerLoadError)) throw error
      throw new UsageError(`${error.message}\n${adapter.setupHint}`)
    })
    runners.set(root, runner)
  }
  const liveRunner = runner
  runner.send({ t: 'collect', file: rel })
  const { tree } = await runner.nextSession('declared')

  const live = new Map<string, Live>()
  runner.onMessage((message) => {
    if (isSessionFrom(message)) {
      if (message.t !== 'log') return
      const owner = message.key === undefined ? undefined : live.get(message.key)
      if (owner) owner.onLog(message)
      else process.stderr.write(`${message.text}\n`)
      return
    }
    if (isRunnerTrialRequest(message)) {
      const slot = live.get(message.key)
      if (slot) return slot.onRequest(message)
      // A body reeval already settled (aborted, or its runner raced its done) gets an answer, so
      // it can't wait on one forever.
      const error = { name: 'AbortError', message: 'The trial this call belongs to has ended' }
      liveRunner.send({ id: message.id, ok: false, op: message.call?.op, error, key: message.key })
    } else if (isRunnerTrialDone(message)) {
      live.get(message.key)?.onDone(message)
    }
  })
  let goneReason: string | undefined
  runner.onGone((reason) => {
    goneReason = reason
    for (const trial of live.values()) trial.gone(reason)
  })

  declareTree(tree.children, (body) => remoteBody(liveRunner, live, body, rel, () => goneReason))
}

let started = 0

function remoteBody(
  runner: LanguageRunner,
  live: Map<string, Live>,
  body: string,
  file: string,
  gone: () => string | undefined,
): EvalFn {
  return (t) =>
    new Promise<void>((resolve, reject) => {
      const trialKey = `${body}:${t.trial.id}:${++started}`
      const handles = new Map<string, BackgroundHandle>()
      const inTrial = AsyncLocalStorage.snapshot()
      const finish = (settle: () => void) => {
        live.delete(trialKey)
        t.signal.removeEventListener('abort', onAbort)
        settle()
      }
      const onAbort = () => {
        const reason = t.signal.reason
        const message =
          reason instanceof Error ? reason.message : String(reason ?? 'The run was canceled')
        runner.send({
          type: 'abort',
          key: trialKey,
          reason:
            reason instanceof Error && reason.name === 'TimeoutError' ? 'timeout' : 'canceled',
          message,
        })
        finish(() => reject(reason))
      }

      live.set(trialKey, {
        onRequest: (message) => {
          void inTrial(() => replyToTrial(t, handles, message)).then((reply) =>
            runner.send({ ...reply, key: trialKey }),
          )
        },
        onLog: ({ stream, text }) =>
          inTrial(() => console[stream === 'stderr' ? 'error' : 'log'](text)),
        onDone: ({ error, turnStatusRead }) =>
          finish(() => {
            const a = trialForContext(t)
            if (a && turnStatusRead === true) a.turnStatusRead = true
            if (!error) return resolve()
            reject(errorFrom(error))
          }),
        gone: (reason) =>
          finish(() =>
            reject(new InfraError(`The language runner stopped mid-trial: ${reason}`)),
          ),
      })

      if (t.signal.aborted) return onAbort()
      // A runner that has gone would never answer this body's start.
      const reason = gone()
      if (reason !== undefined) return live.get(trialKey)?.gone(reason)
      t.signal.addEventListener('abort', onAbort, { once: true })

      const start: RunnerTrialStart = {
        type: 'start',
        key: trialKey,
        trial: t.trial,
        file,
        body,
      }
      runner.send(start)
    })
}
