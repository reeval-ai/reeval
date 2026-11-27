// Which files are eval files, and which of them a path filter picks, matching Vitest's discovery.
import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import picomatch from 'picomatch'
import { glob } from 'tinyglobby'
import { relativeFile, trialId } from '../ids.ts'

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

/** A part that names an eval file in any language, with or without its extension. */
const EVAL_FILE = /\.eval(\.[a-z]+)?$/i

/**
 * Whether a filter part is a path: it names an eval file, or is a file or directory on disk from
 * the current directory (or absolute). Any other part picks evals by id.
 */
export const isPathPart = (part: string): boolean =>
  EVAL_FILE.test(part) || existsSync(resolve(part))

/**
 * Whether an eval file's path relative to the project root is the eval file a part names, at a
 * path-segment boundary and ignoring case: `add.eval` and `evals/add.eval.ts` pick
 * `evals/add.eval.ts`, never `evals/badd.eval.ts`.
 */
export function namesEvalFile(rel: string, part: string): boolean {
  if (!EVAL_FILE.test(part)) return false
  const p = part.replaceAll('\\', '/').replace(/^\.\//, '').toLocaleLowerCase()
  const path = rel.replaceAll('\\', '/').toLocaleLowerCase()
  const stem = path.replace(/(\.eval)\.[a-z]+$/, '$1')
  return [path, stem].some((r) => r === p || r.endsWith(`/${p}`))
}

/**
 * The files the path parts pick: a part on disk picks the files under it, and a part that names
 * an eval file picks it by name (`namesEvalFile`), an absolute one by its path from the root.
 */
export function filterFiles(files: readonly string[], filters: readonly string[], root: string) {
  if (filters.length === 0) return [...files]
  return files.filter((file) =>
    filters.some((f) =>
      existsSync(resolve(f))
        ? isUnder(file, resolve(f))
        : namesEvalFile(relativeFile(root, file), isAbsolute(f) ? relativeFile(root, f) : f),
    ),
  )
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

/** `--cell`: the cell key or `cell#n` trial id, matched exactly. */
export function matchesCell(
  trial: { cell: { key: string }; n: number } | undefined,
  cell: string,
): boolean {
  if (!trial) return false
  return cell === trial.cell.key || cell === trialId(trial.cell.key, trial.n)
}

/** A positional filter part matches an eval's id; cells are picked with `--cell` alone. */
export const matchesFilter = (e: { id: string }, filter: string): boolean =>
  matchesEvalId(e.id, filter)
