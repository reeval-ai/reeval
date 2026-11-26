// The eval's graders on an attempt that just ended, reading what the attempt left as its record
// will keep it: masked, the execs as `execs.jsonl` has them, the workspace as kept.
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { harnessModel, pricerOf } from '../cost.ts'
import { debugLog, debugTrace } from '../debug/attempt.ts'
import type { GradeInputs } from '../grade/context.ts'
import type { GraderDef } from '../grade/define.ts'
import { attemptScore, runGraders, scoreFailure } from '../grade/run.ts'
import { sandboxStarter } from '../grade/sandbox.ts'
import type { GraderTurn } from '../grade/types.ts'
import { changedFiles, execLineOf, historyPatch } from '../history/assemble.ts'
import { turnCost, unpricedTurns } from '../history/cost.ts'
import { diffFiles, keptFiles, type StoredAttempt } from '../history/stored-attempt.ts'
import { WORKSPACE_ARCHIVE, WORKSPACE_MANIFEST } from '../history/types.ts'
import { askJudge, judgeModelName } from '../judge/index.ts'
import { loadPrices } from '../prices.ts'
import { redactSecrets, redactValue } from '../redact.ts'
import { thresholdOf } from '../target.ts'
import { clip, formatDuration } from '../text.ts'
import type { Case, GradeRecord } from '../types.ts'
import { readableWorkspaceManifest } from '../view/record.ts'
import { onJudge } from './judge.ts'
import type { Attempt } from './state.ts'

/** An eval's graders, and the case its attempts grade. */
export type Grading = { graders: readonly GraderDef[]; item: Case }

/** What the attempt left, as `readStoredAttempt` reads it back once the run is recorded. */
async function liveStoredAttempt(a: Attempt, workspaceDir: string): Promise<StoredAttempt> {
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
  const changed = changedFiles(record.diff?.files ?? [], record.diff?.patch)
  return {
    execs: redactValue(record.checks.map(execLineOf)),
    observations: record.observations ?? [],
    decisions: record.decisions ?? [],
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
    changedFiles: changed.map(({ path, status }) => ({ path, status })),
    diff: redactValue({
      patch: record.diff ? historyPatch(record.diff.patch) : '',
      files: diffFiles(changed),
    }),
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
 * the attempt with when it scored under its target's threshold, or the infra error of a grader's
 * sandbox or a judge's provider, which records no grades; undefined when the run was canceled
 * while they ran, which records none.
 */
export async function gradeAttempt(
  a: Attempt,
  grading: Grading,
  key: string,
  workspaceDir: string,
  signal: AbortSignal,
): Promise<Error | undefined> {
  const inputs: GradeInputs = {
    case: grading.item,
    turns: await graderTurns(a),
    stored: await liveStoredAttempt(a, workspaceDir),
    skills: a.env?.record.skills.map((s) => s.name) ?? [],
    subagents: a.record.turns.map((t) => t.subagents),
    judge: {
      ...(a.spec.judge.model !== undefined ? { model: a.spec.judge.model } : {}),
      ask: (question, answers, state, model, signal) =>
        onJudge(a, { ...a.spec.judge, model }, (routed) =>
          tracedAsk(question, answers, state, routed, signal),
        ),
    },
    ...(grading.graders.some((g) => g.run.kind === 'code' && g.run.env) && {
      sandboxes: sandboxStarter(key, a.spec.sandbox),
    }),
  }
  let grades: GradeRecord[]
  try {
    grades = await runGraders(grading.graders, inputs, signal)
  } catch (error) {
    if (signal.aborted) return undefined
    debugLog('check', `grading: ${(error as Error).message}`)
    return error as Error
  }
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
  const threshold = thresholdOf(a.spec.target)
  return score < threshold ? new Error(scoreFailure(score, threshold, grades)) : undefined
}

/** `askJudge`, with its question, prompt and answer in the attempt's debug log. */
async function tracedAsk(...args: Parameters<typeof askJudge>): ReturnType<typeof askJudge> {
  const [question, answers, state, options] = args
  const name = judgeModelName(options.model)
  debugLog('judge', `asking ${name}: ${JSON.stringify(clip(redactSecrets(question), 160))}`)
  debugTrace('judge', 'prompt', { question, answers, state }, 'judge prompt')
  const start = performance.now()
  const ms = () => formatDuration(performance.now() - start)
  try {
    const answer = await askJudge(...args)
    const p = answer.probability === undefined ? '' : ` · P ${answer.probability.toFixed(2)}`
    const retried = answer.retries.length ? ` · ${answer.retries.length} retries` : ''
    debugLog(
      'judge',
      `${answer.resolvedModel ?? answer.model} · ${ms()} · ${JSON.stringify(answer.answer)}${p}${retried}`,
    )
    debugTrace('judge', 'response', answer, 'judge response')
    return answer
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    debugLog('judge', `${name} · ${ms()} · error: ${message}`)
    debugTrace('judge', 'error', { error: message }, 'judge error')
    throw error
  }
}
