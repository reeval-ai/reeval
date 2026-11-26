// The eval's graders on an attempt that just ended, reading what the attempt left as its record
// will keep it: masked, the execs as `execs.jsonl` has them, the workspace as kept.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { harnessModel, pricerOf } from '../cost.ts'
import { debugLog } from '../debug/attempt.ts'
import type { GradeInputs } from '../grade/context.ts'
import type { GraderDef } from '../grade/define.ts'
import { attemptScore, runGraders, scoreFailure } from '../grade/run.ts'
import type { GraderTurn } from '../grade/types.ts'
import { changedFiles, execLineOf } from '../history/assemble.ts'
import { turnCost, unpricedTurns } from '../history/cost.ts'
import { keptFiles, type Trajectory } from '../history/trajectory.ts'
import { WORKSPACE_ARCHIVE, WORKSPACE_MANIFEST } from '../history/types.ts'
import { loadPrices } from '../prices.ts'
import { redactValue } from '../redact.ts'
import type { Case } from '../types.ts'
import { readableWorkspaceManifest } from '../view/record.ts'
import type { Attempt } from './state.ts'

/** An eval's graders, and the case its attempts grade. */
export type Grading = { graders: readonly GraderDef[]; item: Case }

/** What the attempt left, as `readTrajectory` reads it back once the run is recorded. */
async function liveTrajectory(a: Attempt, workspaceDir: string): Promise<Trajectory> {
  const { record } = a
  const artifacts = (record.artifacts ?? []).map((x) => ({
    path: `${x.name}.png`,
    sha256: x.sha256,
    bytes: x.bytes,
    name: x.name,
    mediaType: x.mediaType,
    capture: x.capture,
  }))
  const kept = record.workspace && !record.workspace.skipped
  const manifestPath = join(workspaceDir, WORKSPACE_MANIFEST)
  return {
    execs: redactValue(record.checks.map(execLineOf)),
    observations: record.observations ?? [],
    artifacts,
    readArtifact: async (name) => a.artifactBlobs.get(name) ?? null,
    workspace:
      kept && existsSync(manifestPath)
        ? keptFiles(
            readableWorkspaceManifest(
              JSON.parse(await readFile(manifestPath, 'utf8')),
              WORKSPACE_MANIFEST,
            ),
            join(workspaceDir, WORKSPACE_ARCHIVE),
          )
        : null,
    changedFiles: changedFiles(record.diff?.files ?? [], record.diff?.patch).map(
      ({ path, status }) => ({ path, status }),
    ),
  }
}

/**
 * The attempt's turns as a grader reads them, each with the cost its record will have: the one
 * reported, else its tokens at list prices, loaded only when some turn needs them.
 */
async function graderTurns(a: Attempt): Promise<GraderTurn[]> {
  const pricer = unpricedTurns(a.record.turns)
    ? await loadPrices().then(pricerOf, () => null)
    : null
  const model = harnessModel(a.spec.harness)
  return redactValue(
    a.record.turns.map((t) => {
      const cost = turnCost(t, model, pricer)
      return {
        prompt: t.prompt,
        text: t.text,
        status: t.status,
        startedAt: t.startedAt,
        durationMs: t.durationMs,
        transcript: t.transcript,
        usage: t.usage,
        model: t.model,
        unreported: t.unreported,
        ...(cost ? { cost } : {}),
      }
    }),
  )
}

/**
 * Runs the graders and records their grades and the attempt's score. Returns the error to fail
 * the attempt with when it scored under 1; undefined when the run was canceled while they ran,
 * which records none.
 */
export async function gradeAttempt(
  a: Attempt,
  grading: Grading,
  workspaceDir: string,
  signal: AbortSignal,
): Promise<Error | undefined> {
  const inputs: GradeInputs = {
    case: grading.item,
    turns: await graderTurns(a),
    trajectory: await liveTrajectory(a, workspaceDir),
    skills: a.env?.record.skills.map((s) => s.name) ?? [],
  }
  const grades = await runGraders(grading.graders, inputs, signal)
  if (signal.aborted) return undefined
  const score = attemptScore(grades)
  for (const g of grades) {
    const shown = g.error !== undefined ? `error: ${g.error}` : `score ${g.score ?? 'none'}`
    debugLog('check', `grade ${g.grader} ${shown} (${g.durationMs}ms)`)
    a.report({
      kind: 'grade-end',
      grader: g.grader,
      score: g.score,
      ...(g.error !== undefined ? { error: g.error } : {}),
      ms: g.durationMs,
    })
  }
  a.record.grades = grades
  a.record.score = score
  return score < 1 ? new Error(scoreFailure(score, grades)) : undefined
}
