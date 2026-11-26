import type {
  Experimental_DecisionModelV4 as DecisionModelV4,
  Experimental_DecisionModelV4Answer as DecisionModelV4Answer,
  Experimental_DecisionModelV4CallOptions as DecisionModelV4CallOptions,
} from '@ai-sdk/provider'
import { Experimental_DecisionMockModelV4 } from 'ai/test'

/** A fake decision model's answers, by question id, as a provider returns them. */
export type FakeDecisionAnswers = Record<string, DecisionModelV4Answer>

export type FakeDecisionOptions = {
  /** Default `fake-decision`. */
  modelId?: string
  /** The tokens every call reports. Default 10 in, 2 out. */
  usage?: { inputTokens?: number; outputTokens?: number }
  /** Every call fails with this message, as a provider's error would after its retries. */
  fail?: string
}

/**
 * A decision model for `c.decide()` that answers without a provider: the same answers every
 * call, or the answers `answers` returns for each call's state and questions. The AI SDK's
 * `Experimental_DecisionMockModelV4`, so `experimental_decide` checks them as a provider's.
 */
export function fakeDecisionModel(
  answers:
    | FakeDecisionAnswers
    | ((call: Pick<DecisionModelV4CallOptions, 'state' | 'questions'>) => FakeDecisionAnswers),
  {
    modelId = 'fake-decision',
    usage = { inputTokens: 10, outputTokens: 2 },
    fail,
  }: FakeDecisionOptions = {},
): DecisionModelV4 {
  return new Experimental_DecisionMockModelV4({
    provider: 'fake',
    modelId,
    supportedQuestionTypes: ['choice', 'score', 'boolean', 'box'],
    doDecide: async ({ state, questions }) => {
      if (fail !== undefined) throw new Error(fail)
      return {
        answers: typeof answers === 'function' ? answers({ state, questions }) : answers,
        usage,
        warnings: [],
        response: { modelId },
      }
    },
  })
}
