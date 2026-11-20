// Host devices a sandbox may be given. Each is a name reeval maps to its own vetted flags, never a
// path: the container gets that one device node, read-write, and the device's group, nothing else.
import { docker } from './docker-cli.ts'
import { type Engine, engineSpec } from './engine.ts'
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

/** The `docker run` flags for `devices`, given the group that owns each on the host. */
export function deviceArgs(devices: readonly SandboxDevice[], gids: readonly number[]): string[] {
  return devices.flatMap((name, i) => {
    const { path } = DEVICES[name]
    return ['--device', `${path}:${path}:rw`, '--group-add', String(gids[i])]
  })
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
 * The group that owns `name` on the engine's host, after checking, in `image`, that it's the
 * expected character device and that the user the sandbox runs as can open it read-write. Checked
 * once per engine, image and user. Throws a {@link DeviceError} that says what to fix.
 */
export function deviceGid(
  name: SandboxDevice,
  image: string,
  options: { engine?: Engine; root?: boolean } = {},
): Promise<number> {
  const user = options.root ? '0:0' : SANDBOX_USER
  const key = JSON.stringify([engineSpec(options.engine).bin, image, user, name])
  let gid = probed.get(key)
  if (!gid) {
    gid = probe(name, image, user, options.engine)
    gid.catch(() => probed.delete(key))
    probed.set(key, gid)
  }
  return gid
}

async function probe(name: SandboxDevice, image: string, user: string, engine?: Engine) {
  const { path, major, minor, what } = DEVICES[name]
  const spec = engineSpec(engine)
  const run = (as: string, js: string, extra: string[] = []) =>
    docker(
      [
        'run',
        '--rm',
        '--network',
        'none',
        '--user',
        as,
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
  const stat = await run(user, STAT(path))
  if (stat.exitCode !== 0) {
    throw /no such file|not exist|error gathering device/i.test(stat.stderr)
      ? fail(
          `the ${spec.name} host has none. On Linux, enable virtualization and load the kvm module; Docker Desktop's VM has no ${path}, and Colima needs --vm-type vz --nested-virtualization.`,
        )
      : fail(`checking it failed: ${stat.stderr.trim()}`)
  }
  const s = JSON.parse(stat.stdout.toString('utf8').trim()) as {
    char: boolean
    rdev: number
    gid: number
  }
  if (!s.char || majorOf(s.rdev) !== major || minorOf(s.rdev) !== minor) {
    throw fail(
      `it isn't the ${what} device (character device ${major}:${minor}) on the ${spec.name} host.`,
    )
  }
  const open = await run(user, OPEN(path), ['--group-add', String(s.gid)])
  if (open.exitCode !== 0) {
    throw fail(
      `the sandbox user can't open it read-write with its group (${s.gid}): ${
        open.stderr
          .trim()
          .split('\n')
          .find((l) => /E[A-Z]+:/.test(l)) ?? open.stderr.trim()
      }. Rootless Docker and Podman can't map the host's group into the container.`,
    )
  }
  return s.gid
}
