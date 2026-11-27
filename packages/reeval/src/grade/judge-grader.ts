import { createHash } from 'node:crypto'
import { dirname } from 'node:path'
import { callerFile, DefinitionError, helpersFor } from '../environment.ts'
import { isObjectLike } from '../object.ts'
import { checkName, judgeGrader } from './define.ts'
import type { Grader, GraderHelpers, JudgeGraderSpec, JudgeSpec } from './types.ts'

/** `judge`'s options: its judge spec but the question, and the grader's own options. */
export type JudgeGraderOptions<C = unknown> = Omit<JudgeSpec<C>, 'question'> &
  Omit<JudgeGraderSpec<C>, 'judge'> & {
    /**
     * The grader's name; `judge:<question>` when unset, on one line and at most 80 characters
     * (a longer question is cut and ends in a hash of it).
     */
    name?: string
  }

const OWN = ['name', 'score', 'weight', 'required', 'revision', 'timeout']

/**
 * A judge grader: reeval's judge answers `question` about the stored trial, once per model.
 * Pass options, or a callback that takes the `file` and `directory` helpers for its `reference`.
 *
 *     judge('Is the retry logic easy to review?', {
 *       answers: ['good', 'okay', 'poor'],
 *       inputs: { diff: true },
 *       score: { good: 1, okay: 0.5, poor: 0 },
 *     })
 */
export function judge<C = unknown>(
  question: string,
  options: JudgeGraderOptions<C> | ((helpers: GraderHelpers) => JudgeGraderOptions<C>),
): Grader<C> {
  const file = callerFile()
  const base = file ? dirname(file) : process.cwd()
  const given = typeof options === 'function' ? options(pickHelpers(helpersFor(base))) : options
  const where = `judge(${JSON.stringify(question)})`
  if (!isObjectLike(given) || Array.isArray(given)) {
    throw new DefinitionError(
      `${where} takes options, e.g. judge('Is it readable?', { inputs: { diff: true } }) (got ${typeof given})`,
    )
  }
  const own: Record<string, unknown> = {}
  const spec: Record<string, unknown> = { question }
  for (const [key, value] of Object.entries(given)) (OWN.includes(key) ? own : spec)[key] = value
  const { name, ...rest } = own
  if (name !== undefined) checkName(name, where)
  return judgeGrader(
    name ?? defaultName(question),
    { ...rest, judge: spec },
    where,
    base,
  ) as Grader<C>
}

const MAX_NAME = 80

function defaultName(question: string): string {
  const name = `judge:${String(question).replace(/\s+/g, ' ').trim()}`
  if (name.length <= MAX_NAME) return name
  const hash = createHash('sha256').update(String(question)).digest('hex').slice(0, 8)
  return `${name.slice(0, MAX_NAME - hash.length - 1).trimEnd()}~${hash}`
}

const pickHelpers = ({ file, directory }: ReturnType<typeof helpersFor>): GraderHelpers => ({
  file,
  directory,
})
