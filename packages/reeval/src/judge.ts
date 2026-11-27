// `reeval/judge`: judge helpers and types. Models are `'provider/model'` strings or AI SDK
// decision model objects, e.g. `openai.decisionModel('…')`.
import type { FakeAnalysisModel, FakeJudgeModel } from './types.ts'

/**
 * A judge that returns `score` without calling a model, for tests and dry runs, and `answer` to a
 * judge grader with `answers`. Either can be a function of the state the judge would see (per
 * group, eval or grader; the config takes a number).
 */
export const fakeJudge = ({
  score = 1,
  answer,
}: {
  score?: FakeJudgeModel['score']
  answer?: FakeJudgeModel['answer']
} = {}): FakeJudgeModel => ({
  kind: 'fake-judge',
  score,
  ...(answer !== undefined ? { answer } : {}),
})

/**
 * An analysis model for tests: `reeval explain` gets `output` (or `output(digest)`) back as the
 * model's structured answer, each pairwise question's pair gets `vote` (a fixed `'A'`, `'B'` or
 * `'tie'`, `{ winner, reason? }`, a function of the blinded pair, or `{ error }`), and each
 * question asked of one trial gets `answer` (its text, `{ choice?, text? }`, a function of the
 * blinded trial, or `{ error }`), through the same parsing and validation as a real one.
 */
export const fakeAnalysis = ({
  output,
  vote,
  answer,
}: Pick<FakeAnalysisModel, 'output' | 'vote' | 'answer'>): FakeAnalysisModel => ({
  kind: 'fake-analysis',
  ...(output !== undefined ? { output } : {}),
  ...(vote !== undefined ? { vote } : {}),
  ...(answer !== undefined ? { answer } : {}),
})

export { RECOMMENDED_JUDGE_MODEL } from './judge/index.ts'
export type {
  AnalysisConfig,
  BlindPair,
  BlindTrial,
  ConfigJudgeOptions,
  FakeAnalysisModel,
  FakeAnswer,
  FakeJudgeModel,
  FakeVote,
  JudgeArtifactRef,
  JudgeInputs,
  JudgeModel,
  JudgeOptions,
  JudgeState,
} from './types.ts'
