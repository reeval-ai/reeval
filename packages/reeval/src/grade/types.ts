import type { ArtifactRef, ExecLine } from '../history/types.ts'
import type {
  Case,
  CostUsd,
  DecisionRecord,
  Duration,
  EnvironmentHelpers,
  FileChange,
  HostFile,
  JSONValue,
  TurnData,
} from '../types.ts'

/** A turn as a grader reads it: what the record keeps of it. */
export type GraderTurn = Pick<
  TurnData,
  | 'prompt'
  | 'text'
  | 'status'
  | 'startedAt'
  | 'durationMs'
  | 'transcript'
  | 'usage'
  | 'model'
  | 'unreported'
> & {
  /** What the turn cost: reported, else its tokens at list prices; unset when neither is known. */
  cost?: CostUsd
}

/** A `c.capture()` the attempt made, as a grader reads it. */
export type GraderArtifact = { name: string; png: Buffer; capture?: ArtifactRef['capture'] }

/** A `data` file's content, or a `directory()`'s files' by path. */
export type GraderData = Record<string, string | Record<string, string>>

/**
 * What a grader reads: the attempt as it ended, from the attempt's record. It can't send a turn,
 * run a command or call `expect`.
 */
export type GraderContext<C = unknown> = {
  /** The attempt's case; `{ key: '' }` for an eval without `cases`. */
  case: Case<C>
  /** Each `c.send` turn, with its transcript, masked. */
  turns: readonly GraderTurn[]
  /** Each foreground `c.exec`, in call order, masked. */
  execs: readonly ExecLine[]
  /** The final diff's files: every workspace path the attempt changed, however it changed it. */
  changedFiles: readonly FileChange[]
  /** The skills the attempt's environment placed, by name. */
  skills: readonly string[]
  /** The last `c.observe(name, value)` value; throws when the attempt made none by that name. */
  observation(name: string): JSONValue
  observation(name: string, options: { optional: true }): JSONValue | undefined
  /** A capture's PNG; throws when the attempt has none by that name. */
  artifact(name: string): Promise<GraderArtifact>
  /**
   * A file of the workspace the attempt kept, masked. Throws for a path outside the grader's
   * `files`, or one the attempt didn't keep.
   */
  readFile(path: string): Promise<string>
  /** The attempt's `c.decide()` calls, in call order, as they were recorded (masked). */
  decisions: readonly DecisionRecord[]
  /** The grader's `data` files, read from the host. */
  data: GraderData
  /** Aborted when the grader times out or the run is canceled. */
  signal: AbortSignal
}

/** What `defineGrader` takes. */
export type GraderSpec<C = unknown, G extends JSONValue = JSONValue> = {
  /** Grades the attempt: the value it returns is the grade, which must be JSON. */
  grade: (c: GraderContext<C>) => G | Promise<G>
  /** The grade's score in [0, 1]. Without it a boolean grade scores 1 or 0, and any other none. */
  score?: (grade: G) => number
  /** Its share of the attempt's score. Default 1; 0 records only. */
  weight?: number
  /** A score under 1 (or an error) makes the attempt's score 0. Default false. */
  required?: boolean
  /** Gitignore-style globs of the kept workspace files `c.readFile` may read. Default none. */
  files?: string[]
  /** Host files the grader reads, as `c.data`, from `file()` or `directory()`. */
  data?: Record<string, HostFile | Record<string, HostFile>>
  /** Bump to mark a change the grader's code and data don't show. */
  revision?: number
  /** How long `grade` may take. Default `'5m'`. */
  timeout?: Duration
}

/** What `defineGraders` takes: one `grade` whose grade each named grader scores. */
export type GraderGroupSpec<
  Name extends string,
  C = unknown,
  G extends JSONValue = JSONValue,
> = Omit<GraderSpec<C, G>, 'score' | 'weight' | 'required'> & {
  /** Each grader's score of the shared grade, by name. */
  score: { [K in Name]: (grade: G) => number }
  /** Each grader's share, or a weight for all. Default 1. */
  weight?: number | { [K in Name]?: number }
  /** Whether each grader is required, or all are. Default false. */
  required?: boolean | { [K in Name]?: boolean }
}

/** The helpers `defineGrader`'s callback form takes. */
export type GraderHelpers = Pick<EnvironmentHelpers, 'file' | 'directory'>

declare const caseType: unique symbol

/** A grader for an eval's `graders`: from `defineGrader`, `defineGraders` or `reeval/graders`. */
export type Grader<C = unknown> = {
  /** `code` from `defineGrader` or `defineGraders`, `builtin` from `reeval/graders`. */
  readonly kind: 'code' | 'builtin'
  readonly name: string
  /** Only for type checking: the cases the grader can read. */
  readonly [caseType]?: (item: Case<C>) => void
}

/** An eval's `graders`: graders, and `defineGraders` groups. */
export type GraderList<C = unknown> = ReadonlyArray<Grader<C> | readonly Grader<C>[]>
