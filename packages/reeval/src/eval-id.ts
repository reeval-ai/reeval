// An eval's id. A TypeScript eval file is one eval, whose id is its path from the evals root
// without the `.eval.ts` suffix; another language's file declares a tree, each eval's id
// `file › group › … › name`. Browser-safe: the history readers use it.

const ONE_EVAL_FILE = /\.eval\.[cm]?[jt]s$/

/** Whether `file` is one eval, its default export: a TypeScript or JavaScript eval file. */
export const isOneEvalFile = (file: string) => ONE_EVAL_FILE.test(file)

/** Stable id: the path an eval file's eval declared, after the file for a tree's. */
export const evalId = (file: string, path: readonly string[]) =>
  (isOneEvalFile(file) ? path : [file, ...path]).join(' › ')

/** Stable id for a tree eval or a case entry recorded before one eval per file: always prefixes the file. */
export const legacyEvalId = (file: string, path: readonly string[]) => [file, ...path].join(' › ')

/** The directory every include pattern starts in: `evals/**\/*.eval.ts` → `evals`. */
export function evalRoot(include: readonly string[]): string {
  const dirs = include.map((pattern) => {
    const parts = pattern.split('/')
    const stop = parts.findIndex((part) => GLOB.test(part))
    return (stop < 0 ? parts.slice(0, -1) : parts.slice(0, stop)).filter((p) => p && p !== '.')
  })
  const common: string[] = []
  for (let i = 0; dirs.every((d) => d[i] !== undefined && d[i] === dirs[0]?.[i]); i++) {
    common.push(dirs[0]?.[i] as string)
  }
  return common.join('/')
}

const GLOB = /[*?[\]{}!]/

/** An eval file's id from its path relative to the project root: `evals/foo/bar.eval.ts` → `foo/bar`. */
export function fileEvalId(include: readonly string[], file: string): string {
  const root = evalRoot(include)
  const from = root && file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file
  return from.replace(ONE_EVAL_FILE, '')
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it refuses
const BAD_ID = /[#›\s\u0000-\u001f\u007f]/

/** Why an eval file's id can't be one, or undefined. */
export const badEvalId = (id: string): string | undefined =>
  BAD_ID.test(id)
    ? `its eval id "${id}" (its path from the evals root) holds a #, ›, whitespace or control character. Rename the file.`
    : undefined
