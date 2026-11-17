// A sandbox on a pooled Linux VM a provider starts in the run's main process (machine-service.ts)
// and an attempt reaches over SSH: `daytona()`'s, started from its image. The provider's pool hands
// out slots; this sets up the attempt's slot over SSH and starts it through the shared sequence
// (start.ts). The SSH helpers here are also `boat()`'s and `cloud()`'s, whose attempts run in a
// container on the VM (vm-container.ts).
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connectSsh, type SshMachine, slotLayout } from '@reeval/sandbox-docker'
import { run } from '@reeval/sandbox-docker/process'
import { attemptDebug } from '../debug/attempt.ts'
import { egressLabel } from '../egress.ts'
import { registerSecret } from '../redact.ts'
import type { DaytonaSandboxDescriptor } from '../types.ts'
import { harnessBake } from './harness-install.ts'
import type { SandboxOptions } from './index.ts'
import { leaseMachine } from './machine-service.ts'
import { lostLine } from './pool.ts'
import { startSandbox } from './start.ts'
import { InfraError, type NetworkSandbox, RunStopped } from './types.ts'

/** How a worker reaches a pooled machine: its SSH route, user and keys, in the main process's files. */
export type PooledSshMachine = {
  id: string
  name: string
  /** The provider's machine size, as the record names it. */
  size: string
  host: string
  port: number
  user: string
  identityFile: string
  knownHostsFile: string
  /** How the debug trace names the route: `198.51.100.7:19036 (public endpoint)`. */
  route: string
  /** The login user is a credential (a token), which every trace masks. */
  secretUser?: true
  /** The login user is root, with no `sudo`: a machine started from a built image. */
  loginRoot?: true
  /**
   * Attempts the machine's pool runs on it at once, and whether its slots take another attempt,
   * as the pool laid them out; the descriptor's when the provider doesn't say.
   */
  attemptsPerMachine?: number
  reuse?: boolean
}

/** Past the attempt's timeout, so a machine whose worker was killed still goes away by itself. */
export const TTL_MARGIN_S = 600
/** How many times an attempt asks for another machine when the one it got fails to set up. */
const SETUP_TRIES = 3

/** Where the sandbox user finds the Node (and its npm) the VM's login user runs. */
const AGENT_NODE = '/opt/reeval/node'
/**
 * The login user's `node`, not root's: a VM can have a system Node without npm on the system
 * `PATH` and the one it means in an nvm off it (Daytona's), or link its `node` into the login
 * user's nvm, under a home other users can't enter (Boat's). The sandbox user gets that Node's
 * directory linked when it can read it and a copy when it can't; the record names its version.
 */
const nodeForAgent = (user: string, loginRoot: boolean) =>
  [
    'real="$(PATH="$1"; readlink -f "$(command -v node)" 2>/dev/null || true)"',
    `{ [ -z "$real" ] || [ -x ${AGENT_NODE}/bin/node ] || { prefix="$(dirname "$(dirname "$real")")" && rm -rf ${AGENT_NODE} && mkdir -p "$(dirname ${AGENT_NODE})" && if ${loginRoot ? `setpriv --reuid=${user} --regid=${user} --init-groups --` : `sudo -n -u ${user}`} test -x "$real"; then ln -s "$prefix" ${AGENT_NODE}; else mkdir -p ${AGENT_NODE} && cp -a "$prefix/." ${AGENT_NODE} && chmod -R a+rX ${AGENT_NODE}; fi; }; }`,
  ].join(' && ')

/** A fresh ed25519 key pair in `dir`, made by the host's OpenSSH. */
export async function newKey(
  dir: string,
  provider: string,
): Promise<{ file: string; pub: string }> {
  const file = join(dir, 'id_ed25519')
  const made = await run('ssh-keygen', [
    '-q',
    '-t',
    'ed25519',
    '-N',
    '',
    '-C',
    'reeval',
    '-f',
    file,
  ])
  if (made.exitCode !== 0) {
    throw new InfraError(
      `Couldn't make an SSH key for the ${provider} sandbox: ssh-keygen failed: ${made.stderr.trim()}`,
    )
  }
  return { file, pub: (await readFile(`${file}.pub`, 'utf8')).trim() }
}

/** The host's OpenSSH tools a pooled VM runs on, or the first one missing. */
export async function missingSshTool(
  tools: readonly (readonly [string, readonly string[]])[] = [
    ['ssh', ['-V']],
    ['ssh-keygen', ['-?']],
  ],
): Promise<string | null> {
  for (const [tool, args] of tools) {
    const r = await run(tool, [...args]).catch(() => null)
    if (!r) return tool
  }
  return null
}

export type PooledSshOptions = {
  /** How messages name the sandbox: `boat()`. */
  helper: string
  /** The record's provider: `boat`. */
  sandbox: string
  /** The size the record names when the descriptor sets none. */
  size: string
  /** How messages name one machine: `boat sandbox bx_… (small)`. */
  description(info: PooledSshMachine): string
  /** What the provider's pool starts machines from, as preflight prepared it; part of its key. */
  image?: unknown
  /** The harness install whose home the machine's image keeps, so its slots and resets copy it. */
  homeLabel?: string
}

/**
 * One attempt on a slot of `descriptor`'s pool: leases it, sets it up over SSH as its own user
 * (resetting a reused slot, copying the image's home with the harness into a shared one's) and
 * starts it. A reused slot that fails to set up is dropped and another leased, up to 3 times.
 */
export async function createPooledSshSandbox(
  descriptor: DaytonaSandboxDescriptor,
  options: SandboxOptions,
  o: PooledSshOptions,
): Promise<NetworkSandbox> {
  const debug = attemptDebug()
  return startSandbox(options, {
    helper: o.helper,
    machine: { sandbox: o.sandbox, size: o.size },
    networkNote: `network policy ${egressLabel(options.egress) || 'allow-all'} · the VM keeps its own network, so traffic that ignores the proxy goes out directly, unrecorded`,
    async boot() {
      for (let tries = 1; ; tries++) {
        const lease = await leaseMachine(
          {
            sandbox: descriptor,
            ...(o.image !== undefined && { image: o.image }),
            runId: options.runId,
            ...(options.attempt !== undefined && { attempt: options.attempt }),
            root: process.cwd(),
            ttlSeconds: Math.ceil(options.timeoutMs / 1000) + TTL_MARGIN_S,
          },
          options.signal,
        ).catch((error: unknown) => {
          if (options.signal.aborted) throw options.signal.reason
          if (error instanceof InfraError || error instanceof RunStopped) throw error
          throw new InfraError((error as Error).message)
        })
        const info = lease.info as PooledSshMachine
        if (info.secretUser) registerSecret(info.user)
        const shared = (info.attemptsPerMachine ?? descriptor.attemptsPerMachine ?? 1) > 1
        // A machine of its own that's never reused has the image's home as it is.
        const slotHome = shared || (info.reuse ?? descriptor.reuse)
        const label = slotHome ? o.homeLabel : undefined
        debug?.log(
          'container',
          lease.start
            ? `created ${info.id} (${info.name}, ${info.size}) in ${lease.start.ms}ms${lease.start.queuedMs >= 1000 ? `, ${Math.round(lease.start.queuedMs / 1000)}s of it waiting for the account's start caps` : ''}${lease.start.rateLimited ? `, after ${lease.start.rateLimited} rate-limited starts` : ''}; slot ${lease.slot}`
            : `${lease.reused ? 'reused' : 'shared'} ${info.id} (${info.name}, ${info.size}); slot ${lease.slot}${lease.reused ? `, its attempt ${lease.reused + 1}` : ''}`,
        )
        if (slotHome && !label && options.harness && harnessBake(options.harness)) {
          debug?.log(
            'container',
            `${info.id} slot ${lease.slot}: the image keeps no home with the harness's CLI, so this attempt installs it`,
          )
        }
        for (const lost of lease.lost) debug?.log('container', lostLine(lost))
        const layout = slotLayout(lease.slot)
        const dir = await mkdtemp(join(tmpdir(), `reeval-${o.sandbox}-ssh-`))
        let machine: SshMachine
        try {
          machine = await connectSsh({
            target: {
              host: info.host,
              port: info.port,
              user: info.user,
              identityFile: info.identityFile,
              knownHostsFile: info.knownHostsFile,
              hostKeyAlias: info.id,
              ...(info.loginRoot && { loginRoot: true }),
              controlPath: join(dir, 'cm'),
            },
            description: o.description(info),
            env: options.env,
            path: [`${AGENT_NODE}/bin`],
            prepare: nodeForAgent(layout.user, info.loginRoot === true),
            abortSignal: options.signal,
            ...(shared && { layout }),
            ...(lease.reused && { reset: true }),
            ...(label && { home: label }),
          })
          await machine.home().catch(async (error: unknown) => {
            await machine.close()
            if (options.signal.aborted) throw options.signal.reason
            throw error instanceof InfraError ? error : new InfraError((error as Error).message)
          })
        } catch (error) {
          await rm(dir, { recursive: true, force: true })
          await lease.release(true)
          if (options.signal.aborted || !lease.reused || tries >= SETUP_TRIES) throw error
          debug?.log(
            'container',
            `${info.id} slot ${lease.slot} failed to reset: ${(error as Error).message}`,
          )
          continue
        }
        debug?.log('container', `ssh to ${info.id} over ${info.route}`)
        let healthy = true
        return {
          vm: { id: info.id, name: info.name, size: info.size },
          ...(shared && { shared: true }),
          root: machine.root,
          ...(shared && { proxyPort: layout.proxyPort, stateDir: layout.state }),
          session: (s) => machine.session(s),
          async destroy() {
            await machine.close()
            await rm(dir, { recursive: true, force: true })
            await lease.release(!healthy)
          },
          failed() {
            healthy = false
          },
        }
      }
    },
  })
}
