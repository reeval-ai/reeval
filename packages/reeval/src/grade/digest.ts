// A grader's code digest: its function's source as written, with the content of the module that
// defines it and every local module that module imports, so a change to a helper it calls changes
// the digest. Packages aren't read: the recorded lockfiles cover them.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { originalText } from '../engine/loader.ts'
import { canonicalJson } from '../eval-source.ts'
import { sha256 } from '../ids.ts'

const SPECIFIER =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

const isFile = (path: string) => existsSync(path) && statSync(path).isFile()

/** The file a relative specifier names, as TypeScript resolves it; undefined for none. */
function resolveLocal(from: string, specifier: string): string | undefined {
  const base = resolve(dirname(from), specifier)
  const tries = [
    base,
    ...EXTENSIONS.map((ext) => base + ext),
    ...(/\.[cm]?jsx?$/.test(base) ? EXTENSIONS.map((ext) => base.replace(/\.[cm]?jsx?$/, ext)) : []),
    ...EXTENSIONS.map((ext) => resolve(base, `index${ext}`)),
  ]
  return tries.find(isFile)
}

/** The module and every local module it imports, transitively, by path. */
function localModules(file: string): string[] {
  const seen = new Set<string>()
  const visit = (path: string) => {
    if (seen.has(path)) return
    seen.add(path)
    const text = readFileSync(path, 'utf8')
    for (const match of text.matchAll(SPECIFIER)) {
      const specifier = match[1] ?? match[2]
      if (!specifier?.startsWith('.')) continue
      const found = resolveLocal(path, specifier)
      if (found) visit(found)
    }
  }
  visit(file)
  return [...seen]
}

/** sha256 of `file` and its local modules' content, by path from its directory. */
export function moduleDigest(file: string): string {
  const root = dirname(file)
  const parts = localModules(file)
    .map((path) => [relative(root, path).split('\\').join('/'), sha256(readFileSync(path))])
    .sort(([a], [b]) => ((a as string) < (b as string) ? -1 : 1))
  return sha256(canonicalJson(parts))
}

/** sha256 of `fn`'s source as written, with `file`'s module digest when it's known. */
export function functionDigest(fn: (...args: never[]) => unknown, file: string | undefined): string {
  const text = Function.prototype.toString.call(fn)
  const source = originalText(text, file) ?? text
  return sha256(canonicalJson({ source, ...(file && isFile(file) ? { module: moduleDigest(file) } : {}) }))
}
