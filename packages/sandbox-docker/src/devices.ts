// Host devices a sandbox may be given. Each is a name reeval maps to its own vetted flags, never a
// path: the container gets that one device node, read-write, and the device's group, nothing else.
import { statSync } from 'node:fs'
import { docker } from './docker-cli.ts'
import { type Engine, engineSpec, isRemoteEngine } from './engine.ts'
import { SANDBOX_USER } from './image.ts'

/** A host device by name: `kvm` is `/dev/kvm`, for hardware virtualization (an Android emulator). */
export type SandboxDevice = 'kvm'

export const DEVICES: Readonly<
  Record<SandboxDevice, { path: string; major: number; minor: number; what: string }>
> = {
  kvm: { path: '/dev/kvm', major: 10, minor: 232, what: 'KVM' },
}

/** A device the host can't give the sandbox, and why. */
export class DeviceError extends Error {
  override name = 'DeviceError'
}

/**
 * The `docker run` flags for `devices`, given the group that owns each on the host. Group 0 isn't
 * added: a device the root group owns is one the host gives everyone (`0666`) or no one.
 */
export function deviceArgs(devices: readonly SandboxDevice[], gids: readonly number[]): string[] {
  return devices.flatMap((name, i) => {
    const { path } = DEVICES[name]
    const gid = gids[i] ?? 0
    return ['--device', `${path}:${path}:rw`, ...(gid ? ['--group-add', String(gid)] : [])]
  })
}

/** A device node as `stat` follows it: whether it's a character device, its number and group. */
export type DeviceNode = { char: boolean; rdev: number; gid: number }

/**
 * The node `path` resolves to on this machine, where the engine's daemon may run (Linux), or
 * undefined: reeval's `/dev` can still be another machine's than the daemon's (`DOCKER_HOST`, a
 * context, a mounted `docker.sock`), so this only ever adds a check to the probe container's.
 */
function hostNode(path: string, engine?: Engine): DeviceNode | undefined {
  if (process.platform !== 'linux' || isRemoteEngine(engine)) return undefined
  try {
    const s = statSync(path)
    return { char: s.isCharacterDevice(), rdev: s.rdev, gid: s.gid }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

const STAT = (path: string) =>
  `const s = require("node:fs").statSync(${JSON.stringify(path)}); console.log(JSON.stringify({ char: s.isCharacterDevice(), rdev: s.rdev, gid: s.gid }))`
const OPEN = (path: string) =>
  `require("node:fs").closeSync(require("node:fs").openSync(${JSON.stringify(path)}, "r+"))`

/** Linux's `major()` and `minor()` of a device number. */
const majorOf = (rdev: number) => Math.floor(rdev / 256) & 0xfff
const minorOf = (rdev: number) => (rdev & 0xff) | (Math.floor(rdev / 4096) & 0xfff00)

const probed = new Map<string, Promise<number>>()

/**
 * The group that owns `name` on the engine's host, after checking that it's the expected
 * character device and that the user the sandbox runs as can open it read-write in `image`. The
 * image reads the node it's given; where this machine has the node too, the two must agree, since
 * the image could lie about it.
 * Checked once per engine, image and user. Throws a {@link DeviceError} that says what to fix.
 */
export function deviceGid(
  name: SandboxDevice,
  image: string,
  options: {
    engine?: Engine
    root?: boolean
    /** Reads the node on the host; {@link hostNode} unless set. */
    host?: (path: string) => DeviceNode | undefined
  } = {},
): Promise<number> {
  const user = options.root ? '0:0' : SANDBOX_USER
  const key = JSON.stringify([engineSpec(options.engine).bin, image, user, name])
  let gid = probed.get(key)
  if (!gid) {
    const host = options.host ?? ((path: string) => hostNode(path, options.engine))
    gid = probe(name, image, user, host, options.engine)
    gid.catch(() => probed.delete(key))
    probed.set(key, gid)
  }
  return gid
}

async function probe(
  name: SandboxDevice,
  image: string,
  user: string,
  host: (path: string) => DeviceNode | undefined,
  engine?: Engine,
) {
  const { path, major, minor, what } = DEVICES[name]
  const spec = engineSpec(engine)
  const run = (js: string, extra: string[] = []) =>
    docker(
      [
        'run',
        '--rm',
        '--network',
        'none',
        '--user',
        user,
        '--cap-drop',
        'ALL',
        '--security-opt',
        'no-new-privileges',
        '--device',
        `${path}:${path}:rw`,
        ...extra,
        '--entrypoint',
        'node',
        image,
        '-e',
        js,
      ],
      { engine },
    )
  const fail = (why: string) =>
    new DeviceError(`${spec.fn}({ devices: ['${name}'] }) needs ${what} at ${path}: ${why}`)
  const none = fail(
    `the ${spec.name} host has none. On Linux, enable virtualization and load the kvm module; Docker Desktop's VM has no ${path}, and Colima needs --vm-type vz --nested-virtualization.`,
  )
  const stat = await run(STAT(path))
  if (stat.exitCode !== 0) {
    throw /no such file|not exist|error gathering device/i.test(stat.stderr)
      ? none
      : fail(`checking it failed: ${stat.stderr.trim()}`)
  }
  const node = JSON.parse(stat.stdout.toString('utf8').trim()) as DeviceNode
  const here = host(path)
  const show = (n: DeviceNode) =>
    `${n.char ? 'character' : 'non-character'} device ${majorOf(n.rdev)}:${minorOf(n.rdev)}, group ${n.gid}`
  if (here && (here.char !== node.char || here.rdev !== node.rdev || here.gid !== node.gid)) {
    throw fail(
      `this machine's (${show(here)}) isn't the one the container gets (${show(node)}). Is DOCKER_HOST, a docker context or a mounted docker.sock pointing at another ${spec.name} host?`,
    )
  }
  if (!node.char || majorOf(node.rdev) !== major || minorOf(node.rdev) !== minor) {
    throw fail(
      `it isn't the ${what} device (character device ${major}:${minor}) on the ${spec.name} host.`,
    )
  }
  const open = await run(OPEN(path), node.gid ? ['--group-add', String(node.gid)] : [])
  if (open.exitCode !== 0) {
    if (/error gathering device/i.test(open.stderr)) throw none
    throw fail(
      `the sandbox user can't open it read-write${node.gid ? ` with its group (${node.gid})` : ''}: ${
        open.stderr
          .trim()
          .split('\n')
          .find((l) => /E[A-Z]+:/.test(l)) ?? open.stderr.trim()
      }. Rootless Docker and Podman can't map the host's group into the container.`,
    )
  }
  return node.gid
}
