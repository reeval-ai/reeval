// A grader's code digest: its function's source as written, with the content of the module that
// defines it and of every module that module imports or requires, transitively, so a change to a
// helper it calls changes the digest. Specifiers are found by pattern, not parsed: one that only
// looks like an import adds a file, which costs a recompute, never a stale grade. Each resolves as
// the loader resolves it; packages installed in `node_modules` and reeval itself aren't read,
// since the recorded lockfiles and reeval's version cover them, but a workspace package's source,
// linked in by its real path, is.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, relative, sep } from 'node:path'
import { originalText } from '../engine/loader.ts'
import { DefinitionError, OWN_DIRS } from '../environment.ts'
import { canonicalJson } from '../eval-source.ts'
import { sha256 } from '../ids.ts'
import { resolveImport } from '../jiti.ts'

const SPECIFIER =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]|\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/** Files whose text is read for the specifiers they import. */
const CODE = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])

const isFile = (path: string) => existsSync(path) && statSync(path).isFile()

/** Whether a resolved file is the project's own: not an installed package, not reeval. */
const isOwn = (path: string) =>
  isFile(path) &&
  !path.includes(`${sep}node_modules${sep}`) &&
  !OWN_DIRS.some((d) => path.startsWith(d))

/** The module and every module of the project's own it imports, transitively, by path. */
function ownModules(file: string): string[] {
  const seen = new Set<string>()
  const visit = (path: string) => {
    if (seen.has(path)) return
    seen.add(path)
    if (!CODE.has(extname(path))) return
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(SPECIFIER)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      const found = resolveImport(specifier, path)
      if (found && isOwn(found)) visit(found)
    }
  }
  visit(file)
  return [...seen]
}

/** sha256 of `file` and its own modules' content, by path from its directory. */
export function moduleDigest(file: string): string {
  const root = dirname(file)
  const parts = ownModules(file)
    .map((path) => [relative(root, path).split(sep).join('/'), sha256(readFileSync(path))])
    .sort(([a], [b]) => ((a as string) < (b as string) ? -1 : 1))
  return sha256(canonicalJson(parts))
}

/**
 * sha256 of `fn`'s source as written, with `file`'s module digest when it's known. Refuses a
 * bound or built-in function, whose source isn't there to read.
 */
export function functionDigest(
  fn: (...args: never[]) => unknown,
  file: string | undefined,
  where: string,
): string {
  const text = Function.prototype.toString.call(fn)
  if (/\{\s*\[native code\]\s*\}\s*$/.test(text)) {
    throw new DefinitionError(
      `${where} is a bound or built-in function, whose source reeval can't read to fingerprint the grader. Pass the function itself, e.g. (c) => …, not fn.bind(…).`,
    )
  }
  const source = originalText(text, file) ?? text
  return sha256(
    canonicalJson({ source, ...(file && isFile(file) ? { module: moduleDigest(file) } : {}) }),
  )
}
