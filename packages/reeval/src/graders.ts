// `reeval/graders`: built-in graders over what each attempt records, for an eval's or the
// config's `graders`, and `judge()`, a question for reeval's judge, for an eval's. Each is named
// `<kind>:<main argument>`.
export {
  type BuiltinOptions,
  calledMcp,
  calledTool,
  cost,
  duration,
  fetched,
  hasFile,
  inDiff,
  noPageErrors,
  notInDiff,
  observed,
  pageStatus,
  ran,
  searched,
  succeeded,
  tokens,
  turns,
  usedSkill,
  withinLimits,
  wrote,
} from './grade/builtins.ts'
export { type JudgeGraderOptions, judge } from './grade/judge-grader.ts'
export type { BuiltinGraderData, BuiltinKind } from './types.ts'
