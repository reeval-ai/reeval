import type { TrialRecord, EvalEntry, FileRef } from '../../history/types.ts'
import { type TrialIdMap, trialAnchor, idOf } from './ids.ts'
import type { TrialRef } from './types.ts'

/** Prefix every relative artifact link: `linkBase` as a folder, `./` by default. */
export function withBase(linkBase: string | undefined, path: string): string {
  const base = !linkBase ? (linkBase ?? './') : linkBase.endsWith('/') ? linkBase : `${linkBase}/`
  if (path.startsWith('#')) return path
  if (path.startsWith('../')) return path
  const trimmed = path.replace(/^\.\//, '')
  return `${base}${trimmed}`
}

/** The record's link: `href`, or `../<runId>.json`, the record beside the run's folder. */
export function recordHref(runId: string, href?: string): string {
  return href ?? `../${runId}.json`
}

function kept(ref: FileRef | undefined | null): string | null {
  return ref?.path ?? null
}

/**
 * Citation target for a trial: trajectory, else diff, else first capture, else its anchor in
 * the trial index (`trialAnchor`).
 * `FileRef.path` values are already relative to the run directory.
 * When `used` is set, a path already claimed by another trial falls back to the anchor
 * so baseline and variant cites stay distinct.
 */
export function trialHref(
  _evalEntry: Pick<EvalEntry, 'slug'>,
  trial: TrialRecord,
  linkBase?: string,
  used?: Set<string>,
): string {
  const files = trial.files
  const trajectory = kept(files.trajectory)
  const preferred = trajectory
    ? withBase(linkBase, trajectory)
    : (() => {
        const diff = kept(files.diff)
        if (diff) return withBase(linkBase, diff)
        const capture = files.artifacts?.[0]
        if (capture) return withBase(linkBase, capture.path)
        return trialAnchor(trial.key)
      })()
  if (!used) return preferred
  if (!used.has(preferred) || preferred.startsWith('#')) {
    used.add(preferred)
    return preferred
  }
  const fallback = trialAnchor(trial.key)
  used.add(fallback)
  return fallback
}

export function trialRef(
  ids: TrialIdMap,
  evalEntry: Pick<EvalEntry, 'slug'>,
  trial: TrialRecord,
  linkBase?: string,
  used?: Set<string>,
  hrefByKey?: Map<string, string>,
): TrialRef | null {
  const id = idOf(ids, trial.key)
  if (!id) return null
  const assigned = hrefByKey?.get(trial.key)
  if (assigned) return { id, key: trial.key, href: assigned }
  return { id, key: trial.key, href: trialHref(evalEntry, trial, linkBase, used) }
}

/** Capture PNG link, or null when not kept (caller prints `name (not kept)`). */
export function captureHref(path: string | undefined, linkBase?: string): string | null {
  if (!path) return null
  return withBase(linkBase, path)
}

/** Question input JSON link; omitted when not kept. Paths are run-relative. */
export function questionHref(path: string | undefined, linkBase?: string): string | null {
  if (!path) return null
  return withBase(linkBase, path)
}

/** Worktree patch link, or the "not saved" note when absent. */
export function worktreePatchLink(
  patch: FileRef | null | undefined,
  note: string | null | undefined,
  linkBase?: string,
): { href: string | null; text: string } {
  if (patch) return { href: withBase(linkBase, patch.path), text: 'worktree.patch' }
  return { href: null, text: `not saved: ${note ?? 'unknown'}` }
}

/** GFM heading anchor: lowercase, punctuation stripped, spaces to hyphens. */
export function gfmAnchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function evalAnchorHref(anchor: string): string {
  return `#${anchor}`
}
