# Common mistakes (and the fix)

Each row is a mistake, what reeval says and the fix.

| Mistake | reeval says | Fix |
|---|---|---|
| No `reeval.config.*` | `No reeval.config.ts … here or above. Run reeval init.` | `reeval init`, or pass `--config` |
| `compare` in `reeval.config.ts` | `compare can't be set in reeval.config.ts` | Put it on the eval's `defineEval` |
| `compare: [b]` | `compare … must be an object, not a list` | `compare: { baseline: a, variants: [b] }` |
| `compare: { variants: [b] }` | `compare … has no baseline` | `compare: { baseline: a, variants: [b] }` |
| `compare: { baseline: a, … }` | `Unknown compare option "baseline" … Did you mean "baseline"?` | `compare: { baseline: a, … }` |
| `compare: { strategy: 'peer' }` | `Unknown compare option "strategy"` | Drop it. Variants already run on their own |
| `environments` beside `compare` | `… sets both environments and compare` | Move the environment into `compare.baseline` |
| `evaluate.each(cases)(name, fn)` | `evaluate.each is not a function` | `defineEval({ cases, task: async (c, item) => … })` |
| `cases` for items that should each pass or fail alone | One failing case fails the whole eval | One `*.eval.ts` file per item |
| `where` without `cases` | `… sets where without cases` | Put `where` beside `cases` on `defineEval` |
| `survey(…)`, or `gate: 'observe'` | `survey is not a function` / `Unknown option "gate"` | `defineEval({ task })`: the default `target: capability()` only reports |
| `compare: false` on an eval | `compare: false can't be set` | Use a profile's `limit.compare: false` |
| A question and no language model | `questions "…" (…) needs a language model` (exit 2) | Set `analysis.model`, give the question its own `model`, or set `question: { model }` |
| `import { baseline }` | `reeval has no baseline` | Name the baseline in `compare: { baseline }`; it isn't an export |
| `repeat: 3` / `times` | `Unknown option "repeat" … Did you mean "trials"?` | `trials: 3` |
| `trials: { bestOf: 4 }` | `trials.bestOf … must be an odd whole number of 3 or more` | `trials: { bestOf: 3 }` or `5` |
| `trials: { bestOf: 3 }` with `compare` | `… compares environments, so it can't take trials: { bestOf: 3 }` | a fixed count, `trials: 4` |
| Judge model `'gemini-3.8-flash'` | needs a provider prefix | `'google/gemini-3.8-flash'` |
| `opencode({ model: 'gemini-3.8-flash' })` | `an OpenCode model id names its provider` (exit 2) | `'google/gemini-3.8-flash'` |
| No `judge.model` anywhere | `judge grader … has no model` | Set one, or `fakeJudge()` |
| The judge's provider refuses a big input | The provider's message, then `The judge's input was ~…k tokens (estimated): diff …, of which …` | Add a `.gitignore` to the environment, or narrow the inputs: `{ diff: ['src/'] }` |
| `judge(q, { inputs: {} })`, expecting the judge to see the task, answer and diff by default | `judge.inputs in … shows the judge nothing: turn on at least one, …` | There are no default inputs: turn on what the question needs, `{ diff: true }`, `{ contents: ['README.md'] }`, `{ output: true }`, `{ trajectory: 'tools' }` |
| An input (`diff`, `contents`, …) on a config, profile or eval `judge` | `Unknown judge option "diff" in …. diff is a judge grader's input: judge(question, { inputs: { diff } }).` | Put it in each judge grader's `inputs` |
| A question as a string, or with no input | `questions … takes { question, model?, across?, choices?, turns? } with at least one of task, output, …` / `… shows the model nothing: …` (exit 2) | `{ question: 'Which is cleaner?', across: 'environment', diff: true }` |
| `cursor()` with `fakeSandbox()` | real harnesses need `docker()` | Use `fakeAgent()` or `docker()` |
| Secret as a string literal | refused | `secret.fromEnv('NAME')` in a callback |
| `workspace: 'https://…'` | `must come from the git helper` | `({ git }) => ({ workspace: git('https://…', { ref }) })` |
| `async` environment callback | returned a Promise | Return synchronously; fetch in a `setup` step |
| Test file named `*.test.ts` | `No eval files in … match include: …` (exit 2) | `*.eval.ts` under `evals/` |
| `.env.local` outside the config's directory | `Missing credentials: …` | Put it next to `reeval.config.ts` |
