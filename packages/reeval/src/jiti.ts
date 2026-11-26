// jiti as reeval uses it, for the config and eval files.

import { createRequire, isBuiltin } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Jiti, JitiOptions } from 'jiti'
import { COMPILED, ownDir, ownRequire, PACKAGE_NAMES, PREVIEW } from './root.ts'

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

type CreateJiti = (
  id: string,
  options: JitiOptions,
  parent: {
    onError: (error: unknown) => never
    nativeImport: (id: string) => Promise<unknown>
    createRequire: typeof createRequire
  },
) => Jiti

let factory: CreateJiti | undefined

/**
 * jiti's factory, which its entry points wrap, from the jiti package on disk or, compiled, the
 * copy embedded in it (`vendor/jiti/jiti.cjs`), as {@link jitiTransform} finds Babel.
 */
function jitiFactory(): CreateJiti {
  if (!factory) {
    const file = COMPILED
      ? join(ownDir('vendor/jiti'), 'jiti.cjs')
      : join(dirname(ownRequire.resolve('jiti/package.json')), 'dist/jiti.cjs')
    factory = createRequire(file)(file) as CreateJiti
  }
  return factory
}

/**
 * How jiti imports a module it doesn't transform. A builtin is `require`'s object rather than its
 * ESM namespace, which Bun doesn't sync with it, so `trackLoad`'s wrapped `fs` sees a named
 * `node:fs` import's reads on Bun as on Node.
 */
const nativeImport = (id: string) => (isBuiltin(id) ? Promise.resolve(ownRequire(id)) : import(id))

/**
 * A jiti that imports from `id`. Compiled, or a preview build, a file's imports of reeval itself
 * get this reeval's own modules: a copy on disk would register evals, and hold state, this reeval
 * can't see, and a preview runs over a project whose lockfile installs a release. It
 * transforms every module on Bun as on Node (jiti's `tryNative` is on by default on Bun, which
 * would load some without `trackLoad` seeing them), so both runtimes record the same inputs.
 */
export async function reevalJiti(id: string, options: JitiOptions = {}): Promise<Jiti> {
  const virtualModules = COMPILED || PREVIEW ? await ownModules() : undefined
  return jitiFactory()(
    id,
    {
      transform: jitiTransform,
      tryNative: false,
      ...options,
      ...(virtualModules && { virtualModules }),
    },
    {
      onError: (error) => {
        throw error
      },
      nativeImport,
      createRequire,
    },
  )
}

let resolver: Jiti | undefined

/**
 * The file `specifier` names when `parent` imports or requires it, resolved as jiti loads it
 * (extensionless and `.js`-for-`.ts` paths, `#` imports, packages by their real path); undefined
 * for a builtin or a module it can't find.
 */
export function resolveImport(specifier: string, parent: string): string | undefined {
  if (isBuiltin(specifier)) return undefined
  resolver ??= jitiFactory()(
    parent,
    { transform: jitiTransform, tryNative: false },
    {
      onError: (error) => {
        throw error
      },
      nativeImport,
      createRequire,
    },
  )
  try {
    const url = resolver.esmResolve(specifier, { parentURL: parent, try: true })
    return url?.startsWith('file:') ? fileURLToPath(url) : url
  } catch {
    return undefined
  }
}

/** Every module subpath in package.json's `exports`, which `test/manifest.test.ts` holds it to. */
export const OWN_EXPORTS: Record<string, () => Promise<unknown>> = {
  '': () => import('./index.ts'),
  '/agent': () => import('./agent.ts'),
  '/sandbox': () => import('./sandbox.ts'),
  '/provider/boat': () => import('./provider-boat.ts'),
  '/provider/daytona': () => import('./provider-daytona.ts'),
  '/store/local': () => import('./store-local.ts'),
  '/store/s3': () => import('./store-s3.ts'),
  '/judge': () => import('./judge.ts'),
  '/graders': () => import('./graders.ts'),
  '/graders/match': () => import('./graders-match.ts'),
  '/internal/vm': () => import('./internal-vm.ts'),
  '/internal/vm-api': () => import('./internal-vm-api.ts'),
  '/internal/vm-api/boat': () => import('./internal-vm-api-boat.ts'),
  '/internal/vm-api/daytona': () => import('./internal-vm-api-daytona.ts'),
  '/gateway': () => import('./gateway.ts'),
  '/view': () => import('./view/index.ts'),
  '/view/report': () => import('./view/report/index.ts'),
  '/renderer/markdown': () => import('./renderer/markdown.ts'),
  '/renderer/ascii': () => import('./renderer/ascii.ts'),
  '/testing': () => import('./testing.ts'),
}

async function ownModules(): Promise<Record<string, unknown>> {
  const modules: Record<string, unknown> = {}
  for (const [subpath, load] of Object.entries(OWN_EXPORTS)) {
    const module = await load()
    for (const name of PACKAGE_NAMES) modules[name + subpath] = module
  }
  return modules
}
