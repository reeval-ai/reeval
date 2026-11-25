// Which files are eval files, and which of them a path filter picks, matching Vitest's discovery.
import { isAbsolute, relative, resolve } from 'node:path'
import picomatch from 'picomatch'
import { glob } from 'tinyglobby'
import { attemptId, relativeFile } from '../ids.ts'

/** Never searched for eval files. */
export const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/.git/**']

/** Every file under `root` matching `include` and none of `exclude`, as absolute paths, sorted. */
export async function findEvalFiles(
  root: string,
  include: readonly string[],
  exclude: readonly string[],
): Promise<string[]> {
  const files = await glob([...include], {
    cwd: root,
    dot: true,
    ignore: [...exclude],
    expandDirectories: false,
  })
  return files.map((file) => resolve(root, file)).sort()
}

/**
 * The files a filter part picks: those whose path relative to `root` contains it, ignoring case,
 * or contains it resolved from the current directory; an absolute path picks what's under it.
 */
export function filterFiles(files: readonly string[], filters: readonly string[], root: string) {
  if (filters.length === 0) return [...files]
  // Compared with forward slashes, so `evals/a` picks `evals\a.eval.ts` on Windows, as does `evals\a`.
  const slashed = (path: string) => path.replaceAll('\\', '/')
  return files.filter((file) => {
    const rel = relativeFile(root, file).toLocaleLowerCase()
    return filters.some((f) => {
      if (isAbsolute(f) && isUnder(file, resolve(f))) return true
      const typed = slashed(f)
      const fromCwd = relativeFile(root, f) + (typed.endsWith('/') ? '/' : '')
      return rel.includes(typed.toLocaleLowerCase()) || rel.includes(fromCwd.toLocaleLowerCase())
    })
  })
}

/** Whether `file` is `dir` or under it; any case on Windows, where paths ignore it. */
function isUnder(file: string, dir: string): boolean {
  const rel = relative(dir, file)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const GLOB_IN_FILTER = /[*?[\]{}!]/

/** Normalizes a filter part: `good/` is the segment prefix `good`, same as `good`. */
const filterSegment = (filter: string) => (filter.endsWith('/') ? filter.slice(0, -1) : filter)

/** A Python tree eval's id still matches filter substrings; one-eval-file ids match exactly, as a segment prefix, or by glob. */
export function matchesEvalId(id: string, filter: string): boolean {
  const segment = filterSegment(filter)
  if (id.includes(' › ')) return id.includes(filter.endsWith('/') ? segment : filter)
  if (id === segment) return true
  const hash = segment.lastIndexOf('#')
  if (hash > 0) return id === segment
  if (id.startsWith(`${segment}/`)) return true
  if (GLOB_IN_FILTER.test(segment)) return picomatch(segment, { dot: true })(id)
  return false
}

/** `--cell`: the cell key or `cell#n` attempt id, matched exactly. */
export function matchesCell(
  attempt: { cell: { key: string }; n: number } | undefined,
  cell: string,
): boolean {
  if (!attempt) return false
  return cell === attempt.cell.key || cell === attemptId(attempt.cell.key, attempt.n)
}

/** A positional filter part matches an eval's id; cells are picked with `--cell` alone. */
export const matchesFilter = (e: { id: string }, filter: string): boolean =>
  matchesEvalId(e.id, filter)
