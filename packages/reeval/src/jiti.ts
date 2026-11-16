// jiti as reeval uses it, for the config and eval files.

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createJiti, type Jiti, type JitiOptions } from 'jiti'
import { COMPILED, ownDir, ownRequire, PACKAGE_NAMES } from './root.ts'

type Transform = NonNullable<JitiOptions['transform']>

let babel: Transform | undefined

/** Every file jiti has transformed in this process: the TypeScript and ESM modules it loaded. */
export const transformedFiles = new Set<string>()

/**
 * jiti's own Babel transform. jiti requires it lazily from beside its code, which a compiled reeval
 * doesn't have, so reeval requires the same file: from the jiti package on disk, or, compiled, from
 * the copy embedded in it (`vendor/jiti/babel.cjs`), copied out to disk.
 *
 * Babel replaces `Error.prepareStackTrace` for the whole process on its first transform, with a
 * hook that hands every stack to the one it replaced. Bun's own throws for an object that isn't
 * an Error, which `Error.captureStackTrace(this)` in a plain constructor passes (follow-redirects,
 * under `@daytona/sdk`), so each transform puts back the `Error.prepareStackTrace` it found.
 */
export const jitiTransform: Transform = (options) => {
  if (options.filename) transformedFiles.add(options.filename)
  if (!babel) {
    const file = COMPILED
      ? join(ownDir('vendor/jiti'), 'babel.cjs')
      : join(dirname(ownRequire.resolve('jiti/package.json')), 'dist/babel.cjs')
    babel = createRequire(file)(file) as Transform
  }
  const prepareStackTrace = Error.prepareStackTrace
  try {
    return babel(options)
  } finally {
    Error.prepareStackTrace = prepareStackTrace
  }
}

/**
 * A jiti that imports from `id`. Compiled, a file's imports of reeval itself get this reeval's own
 * modules: a copy on disk would register evals, and hold state, the executable can't see.
 */
export async function reevalJiti(id: string, options: JitiOptions = {}): Promise<Jiti> {
  const virtualModules = COMPILED ? await ownModules() : undefined
  return createJiti(id, {
    transform: jitiTransform,
    ...options,
    ...(virtualModules && { virtualModules }),
  })
}

async function ownModules(): Promise<Record<string, unknown>> {
  const exports: Record<string, Promise<unknown>> = {
    '': import('./index.ts'),
    '/harness': import('./harness.ts'),
    '/sandbox': import('./sandbox.ts'),
    '/sandbox/boat': import('./sandbox-boat.ts'),
    '/sandbox/daytona': import('./sandbox-daytona.ts'),
    '/store/local': import('./store-local.ts'),
    '/store/s3': import('./store-s3.ts'),
    '/judge': import('./judge.ts'),
    '/internal/vm': import('./internal-vm.ts'),
    '/gateway': import('./gateway.ts'),
    '/view': import('./view/index.ts'),
  }
  const modules: Record<string, unknown> = {}
  for (const [subpath, module] of Object.entries(exports))
    for (const name of PACKAGE_NAMES) modules[name + subpath] = await module
  return modules
}
