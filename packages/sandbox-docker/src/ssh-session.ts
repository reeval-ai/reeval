import { posix } from 'node:path'
import type { Gateway } from './egress/gateway.ts'
import {
  asRootPrefix,
  controlOptions,
  type ExecTransport,
  type SshTarget,
  sshArgv,
  sshTransport,
} from './egress/transport.ts'
import { SANDBOX_HOME, SANDBOX_USER, type SlotLayout, slotLayout } from './image.ts'
import { shellQuote as q, run as runHost } from './process.ts'
import type { DockerSession } from './session.ts'
import { EXEC_UMASK, linuxShell, SYSTEM_PATH } from './shells.ts'
import { traceDocker } from './trace.ts'
import { type SessionShell, transportSession } from './transport-session.ts'

export type SshSessionOptions = {
  target: SshTarget
  /** How messages name the sandbox: `boat sandbox bx_… (small)`. */
  description: string
  /** Set for every process the sandbox user runs; sent on each command's stdin, never in argv. */
  env?: Record<string, string>
  /**
   * The sandbox user's `PATH`, ahead of the system's. The VM's own `node` may sit where that user
   * can't read it, so `prepare` puts one where it can.
   */
  path?: readonly string[]
  /**
   * Root shell commands that run once, after the sandbox user and its directories exist. `$1` is
   * the login user's `PATH`, which `sudo` replaces with its own.
   */
  prepare?: string
  /** How long the VM may take to accept SSH after it reports ready. */
  connectTimeoutMs?: number
  abortSignal?: AbortSignal
  /**
   * Where the trial lives, on a machine that runs several at once; setting up runs under a lock
   * the others share. Default slot 0's, the machine's only trial.
   */
  layout?: SlotLayout
  /** The slot ran a trial before: kill what its user left running and delete its files. */
  reset?: boolean
  /** The label of the home the machine's image kept ({@link keepHomeCopy}), which {@link SshMachine.home} copies in. */
  home?: string
}

/** A Linux VM reeval set up over SSH, before its session: what the egress gateway starts on. */
export type SshMachine = {
  /** Runs the gateway's forwarder as root, over the session's connection. */
  root: ExecTransport
  /** Gives the sandbox user the home the machine's image kept under `home`, when it kept one. */
  home(): Promise<void>
  /**
   * The VM as a harness session, on `gateway` when it started (or with why it didn't). Its
   * `destroy` is the caller's: close the gateway, then {@link SshMachine.close}, then the VM.
   */
  session(o: {
    gateway: Gateway | undefined
    noGateway: string | undefined
    destroy: () => Promise<void>
  }): DockerSession
  /** Closes the shared SSH connection. */
  close(): Promise<void>
}

/** ssh's own exit status: it couldn't connect, or the connection dropped. */
const SSH_FAILED = 255
/** Held while one slot sets up, so slots sharing a machine don't install the same things at once. */
const SETUP_LOCK = '/var/lock/reeval-setup'
/** The machine's homes, root's: `home-<label>.tar`. */
const HOMES = '/var/lib/reeval-pool'

const homeTar = (label: string) => `${HOMES}/home-${label.replace(/[^A-Za-z0-9._-]/g, '_')}.tar`

/**
 * Root commands that keep the sandbox user's home as the machine's copy for `label`, which a slot
 * unpacks into its own home rather than installing: what an image with the install baked in runs.
 */
export const keepHomeCopy = (label: string) =>
  `mkdir -p ${q(HOMES)} && chmod 700 ${q(HOMES)} && tar -C ${q(posix.dirname(SANDBOX_HOME))} -cf ${q(homeTar(label))} ${q(posix.basename(SANDBOX_HOME))}`

/** The variables the machine's image sets (its `ENV`), as `NAME=value\0` for each. */
const IMAGE_ENV = '/etc/reeval/image-env'

/**
 * Root commands an image runs last to keep its variables, which no SSH login applies, for the
 * sandbox user's commands: what `docker exec` would start them with.
 */
export const keepImageEnv = () =>
  `mkdir -p ${posix.dirname(IMAGE_ENV)} && cat /proc/self/environ > ${IMAGE_ENV}`

/** What the build's own shell set rather than the image. */
const BUILD_ONLY = new Set(['HOSTNAME', 'HOME', 'PWD', 'OLDPWD', 'SHLVL', '_'])

/** The variables {@link keepImageEnv} kept. */
export function imageEnv(kept: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const kv of kept.split('\0')) {
    const at = kv.indexOf('=')
    if (at > 0 && !BUILD_ONLY.has(kv.slice(0, at))) env[kv.slice(0, at)] = kv.slice(at + 1)
  }
  return env
}

/**
 * Root commands that empty a slot's home back to the skeleton. The directory itself stays: on a
 * shared machine, slot 0's is where the other slots' commands see their own homes.
 */
const skeletonHome = (layout: SlotLayout) => {
  const [u, home] = [q(layout.user), q(layout.home)]
  return `mkdir -p ${home} && find ${home} -mindepth 1 -delete && cp -a /etc/skel/. ${home}/ && chown -R -h ${u}:${u} ${home} && chmod 700 ${home}`
}

/**
 * The file systems a slot's user can leave files on: the root and the usual tmpfs mounts, each
 * walked on its own since the walk stays on one file system. Outside its home and working root,
 * the user can only create entries in a world-writable directory.
 */
const USER_WRITABLE_MOUNTS = [
  '/',
  '/tmp',
  '/var/tmp',
  '/dev/shm',
  '/run',
  '/run/lock',
  '/dev/mqueue',
]

/** Container engines' image stores, whose layers hold files of any uid, the user's included. */
const ENGINE_STORES = ['/var/lib/docker', '/var/lib/containerd', '/var/lib/containers']

/**
 * Root commands that put a used slot back as a new one finds it: none of its user's processes,
 * cron or at jobs, lingering, files in world-writable directories or System V IPC objects, an empty
 * working root and state directory, and the skeleton home.
 *
 * The processes die by `kill(-1)` sent as the user, which the kernel delivers to every process
 * of theirs at once, so one that keeps forking a new pid and exiting can't slip between a listing
 * and its kill as it does past `pkill`. `pkill` stays for a machine without `setpriv`.
 */
export function resetSlot(layout: SlotLayout): string {
  const u = q(layout.user)
  const killAll = `setpriv --reuid="$uid" --regid="$(id -g ${u})" --clear-groups sh -c 'kill -KILL -1' 2>/dev/null`
  return [
    `if uid=$(id -u ${u} 2>/dev/null); then`,
    // Before the kill, so no job they schedule starts a process after it.
    `crontab -r -u ${u} 2>/dev/null`,
    `atq 2>/dev/null | awk -v u=${u} '$NF == u { print $1 }' | xargs -r atrm 2>/dev/null`,
    `loginctl disable-linger ${u} 2>/dev/null`,
    `for i in 1 2 3 4 5 6 7 8 9 10; do ${killAll} || pkill -KILL -u ${u}; pgrep -u ${u} >/dev/null || break; sleep 0.2; done`,
    `rm -rf ${q(layout.root)} ${q(layout.state)}`,
    // -execdir at both levels: another slot can swap its own directories for symlinks mid-walk, so
    // nothing is looked up again by path. -execdir refuses a PATH with an empty or relative entry.
    `PATH=/usr/sbin:/usr/bin:/sbin:/bin find ${USER_WRITABLE_MOUNTS.join(' ')} -xdev \\( ${[layout.home, ...ENGINE_STORES].map((p) => `-path ${q(p)}`).join(' -o ')} \\) -prune -o -type d -perm -0002 -execdir sh -c 'for d; do find "$d" -mindepth 1 -maxdepth 1 -user "$0" -execdir rm -rf --one-file-system -- {""} +; done' ${u} {} + 2>/dev/null`,
    // By uid: ipcs cuts owner names to 10 characters, so reeval-s10 would match reeval-s100.
    `for t in shm:m sem:s msg:q; do awk -v id="$uid" 'NR == 1 { for (i = 1; i <= NF; i++) if ($i == "uid") c = i; next } $c == id { print $2 }' /proc/sysvipc/\${t%:*} 2>/dev/null | xargs -r -n1 ipcrm -\${t#*:} 2>/dev/null; done`,
    skeletonHome(layout),
    'fi; true',
  ].join('\n')
}

/**
 * The root script that unpacks the machine's home for `label` into a slot's home, when the image
 * kept one: every slot sees its home at one path, so the copy needs no change.
 */
function slotHome(layout: SlotLayout, label: string): string {
  const tar = q(homeTar(label))
  const [u, home] = [q(layout.user), q(layout.home)]
  return `[ ! -f ${tar} ] || { find ${home} -mindepth 1 -delete && tar -C ${home} --strip-components=1 -xpf ${tar} && chown -R -h ${u}:${u} ${home} && chmod 700 ${home}; }`
}

/**
 * Sets up a Linux VM reached over SSH for a harness session: the login user has passwordless
 * `sudo` or is root ({@link SshTarget.loginRoot}), and the agent, setup steps and checks run as {@link SANDBOX_USER}, a user made here with
 * no `sudo` and none of the login user's groups or variables. Ports are reached through the
 * egress gateway's tunnel. When setting up fails, the connection is closed.
 */
export async function connectSsh(options: SshSessionOptions): Promise<SshMachine> {
  const { target, abortSignal: signal } = options
  const layout = options.layout ?? slotLayout(0)
  const userEnv = {
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NPM_CONFIG_PREFIX: `${SANDBOX_HOME}/.local`,
    ...options.env,
  }

  const hostRun: SessionShell['run'] = async (argv, o) => {
    const [bin = 'ssh', ...args] = argv
    const startedAt = Date.now()
    try {
      const r = await runHost(bin, args, { input: o.input ?? '', signal: o.signal, binary: true })
      traceDocker(args, startedAt, { ...r, stdin: o.input?.length ?? 0 }, 'ssh')
      return r
    } catch (error) {
      traceDocker(args, startedAt, { error }, 'ssh')
      throw error
    }
  }
  const ssh = (remote: string) => hostRun(sshArgv(target, remote), { input: '', signal })
  const closeConnection = async () => {
    if (!controlOptions(target.controlPath, 0).length) return
    const [bin = 'ssh', ...args] = sshArgv(target, '')
    await runHost(bin, ['-O', 'exit', ...args.slice(0, -1)]).catch(() => {})
  }
  const fail = async (error: unknown): Promise<never> => {
    await closeConnection()
    throw signal?.aborted ? signal.reason : error
  }

  const { user } = layout
  const addUser = (name: string) =>
    `{ id -u ${name} >/dev/null 2>&1 || useradd --create-home --shell /bin/bash --user-group ${name}; }`
  const setup = [
    EXEC_UMASK,
    ...(options.reset ? [`{ ${resetSlot(layout)}\n}`] : []),
    ...(layout.home === SANDBOX_HOME
      ? [addUser(user)]
      : [
          `{ command -v unshare && command -v setpriv && command -v mount; } >/dev/null || { echo "a machine shared by trials needs unshare, setpriv and mount (util-linux)" >&2; false; }`,
          // Its commands see its home where slot 0's is, which must be there to bind it over.
          addUser(SANDBOX_USER),
          `chmod 700 ${SANDBOX_HOME}`,
          `{ id -u ${user} >/dev/null 2>&1 || useradd --no-create-home --home-dir ${SANDBOX_HOME} --shell /bin/bash --user-group ${user}; }`,
          `{ [ -d ${layout.home} ] || { cp -a /etc/skel ${layout.home} && chown -R ${user}:${user} ${layout.home}; }; }`,
        ]),
    `mkdir -p ${layout.root} && chown ${user}:${user} ${layout.root}`,
    // Slots sharing a machine are users of one host: neither reads the other's work.
    `chmod 700 ${layout.root} ${layout.home}`,
    `mkdir -p ${layout.state} && chown 0:0 ${layout.state} && chmod 700 ${layout.state}`,
    ...(options.prepare ? [options.prepare] : []),
  ].join(' && ')
  const sudo = asRootPrefix(target)
  const asRoot = options.layout
    ? `${sudo}flock ${SETUP_LOCK} /bin/sh -c ${q(setup)} sh "$PATH"`
    : `${sudo}/bin/sh -c ${q(setup)} sh "$PATH"`
  // A VM that just reported ready may not take SSH connections for a few seconds more.
  const deadline = Date.now() + (options.connectTimeoutMs ?? 60_000)
  for (let wait = 500; ; wait = Math.min(wait * 2, 5_000)) {
    const made = await ssh(asRoot).catch(fail)
    if (made.exitCode === 0) break
    if (made.exitCode !== SSH_FAILED || Date.now() + wait > deadline) {
      const why = made.stderr.trim() || made.stdout.toString('utf8').trim()
      return fail(new Error(`Couldn't set up ${options.description}: ${why.slice(-500)}`))
    }
    await new Promise((resolve) => setTimeout(resolve, wait))
    if (signal?.aborted) return fail(signal.reason)
  }
  const kept = await ssh(`cat ${IMAGE_ENV} 2>/dev/null`).catch(fail)
  if (kept.exitCode === SSH_FAILED) {
    return fail(
      new Error(`Couldn't read ${options.description}'s image variables: ${kept.stderr.trim()}`),
    )
  }
  const image = kept.exitCode === 0 ? imageEnv(kept.stdout.toString('utf8')) : {}
  const baseEnv = {
    LANG: 'C.UTF-8',
    ...image,
    PATH: [
      ...new Set(
        [`${SANDBOX_HOME}/.local/bin`, ...(options.path ?? []), image.PATH || SYSTEM_PATH]
          .join(':')
          .split(':'),
      ),
    ].join(':'),
    HOME: SANDBOX_HOME,
    USER: layout.user,
    LOGNAME: layout.user,
    SHELL: '/bin/bash',
  }

  const shell = linuxShell({
    run: hostRun,
    remote: (command) => sshArgv(target, command),
    // Slots on one machine number their commands alike, so the marker kill finds names the slot.
    id: `${target.hostKeyAlias}-${layout.user}`,
    user: baseEnv,
    signal,
    layout,
    ...(target.loginRoot && { loginRoot: true }),
  })
  return {
    root: sshTransport(target),
    // Outside the setup lock: slots copy the machine's home at once.
    async home() {
      if (!options.home) return
      const r = await ssh(
        `${sudo}/bin/sh -c ${q(`${EXEC_UMASK}\n${slotHome(layout, options.home)}`)}`,
      )
      if (r.exitCode !== 0) {
        throw new Error(
          `Couldn't give ${user} the machine's home in ${options.description}: ${r.stderr.trim().slice(-500)}`,
        )
      }
    },
    async close() {
      await closeConnection()
    },
    session: ({ gateway, noGateway, destroy }) =>
      transportSession({
        id: target.hostKeyAlias,
        description: options.description,
        defaultWorkingDirectory: layout.root,
        shell,
        env: (env) => ({ ...userEnv, ...gateway?.env, ...env }),
        gateway,
        egress: gateway ? { active: true } : { active: false, reason: noGateway ?? '' },
        async portWithoutGateway(port) {
          throw new Error(
            `Port ${port} of ${options.description} isn't reachable: the egress gateway ${gateway?.stopped ? `stopped: ${gateway.stopped}` : "isn't running"}`,
          )
        },
        destroy,
      }),
  }
}
