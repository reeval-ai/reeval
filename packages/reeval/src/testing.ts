// `reeval/testing`: helpers for fixture evals. Not the authoring API.
import type { TrialReply, TrialRequest } from './contract/trial.ts'
import { replyToTrial } from './language-runner/trial-host.ts'
import type { BackgroundHandle, TrialContext } from './types.ts'

export type { FakeInstructionStep, FakeInstructions } from './capture/fake-instructions.ts'
export { fakeInstructions } from './capture/fake-instructions.ts'
export type { FakeDecisionAnswers, FakeDecisionOptions } from './decide-fake.ts'
export { fakeDecisionModel } from './decide-fake.ts'
export type { DeclarationTree, DeclaredNode } from './declaration.ts'
export { declareTree } from './evaluate.ts'
export type { CaptureKey, CaptureUseAction, Wait } from './types.ts'

const handles = new WeakMap<TrialContext, Map<string, BackgroundHandle>>()

/** reeval's reply to a trial-protocol request on the running trial, as a remote runner gets it. */
export function trialReply(c: TrialContext, request: TrialRequest): Promise<TrialReply> {
  const own = handles.get(c) ?? new Map<string, BackgroundHandle>()
  handles.set(c, own)
  return replyToTrial(c, own, request)
}
