# Vocabulary

reeval's terms, and what other eval frameworks (Inspect, Harbor, SWE-bench) call them. Use
reeval's word in code and messages.

| reeval | Elsewhere called |
|---|---|
| eval (`defineEval`, one file) | task, test case |
| case (an item of `cases`) | sample, example, instance |
| trial (one run of a cell; `trials: n`) | trial (Anthropic, Harbor), epoch (Inspect), repetition |
| harness (`cursor()`, …) | agent harness, scaffold, solver (reeval itself is the *evaluation* harness) |
| cell (harness × environment × sandbox) | a factorial-design cell |
| baseline, variant | baseline, treatment |
| lift (variant mean score − baseline mean score, 95% interval) | treatment effect, delta, uplift |
| target (how a cell's trials decide its outcome) | `regression()` is pass^k, `capability()` pass@k (the default); epoch reducer (Inspect), quality gate |
| pass@1 (passes over passes and fails; `pass_at_1` in `reeval query`) | success rate, resolve rate (SWE-bench) |
| graders, judge (`defineGrader`, `reeval/graders`, `judge()`) | verifier, scorer, evaluator, check |
| trajectory (`trajectory.jsonl`) | transcript, trace |
| effort (measured tool calls, agent time, tokens, cost) | efficiency |
