import { defineEval, defineGrader } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'
import { channels, PREAMBLE, project } from './channels.ts'
import { dryRun, planOf, runOnFake, typecheck } from './checks.ts'

const source = 'evals/readme.eval.ts'

const task =
  PREAMBLE +
  'Write evals/readme.eval.ts: an eval that asks the agent to write README.md for the CLI in ' +
  'cli.js. Check deterministically that README.md exists and mentions `--help`, and ask the ' +
  'LLM judge whether the README explains how to install and run the CLI, naming that judge ' +
  '`explains-usage`. Any check that misses must fail `npx reeval run`. It must typecheck with ' +
  '`npx tsc -p .` and pass with `npx reeval run`.'

export default defineEval({
  compare: channels(project('cli', 'judge')),
  graders: [
    hasFile(source),
    succeeded('typechecks'),
    defineGrader('plans-one-eval', { grade: (c) => planOf(c)?.totals.evals === 1 }),
    succeeded('passes-on-the-fake-config'),
    defineGrader('names-its-judge-explains-usage', {
      grade: (c) =>
        planOf(c)?.evals[0]?.graders.some(
          (g) => g.kind === 'judge' && g.name === 'explains-usage',
        ) ?? false,
    }),
    defineGrader('fails-the-run-on-a-miss', {
      grade: (c) => {
        const target = planOf(c)?.evals[0]?.target
        return target?.kind === 'regression' || target?.blocking === true
      },
    }),
    hasFile(source, /README\.md/, { name: 'checks-readme-md-deterministically' }),
    hasFile(source, /--help/, { name: 'checks-help' }),
  ],
  task: async (c) => {
    await c.send(task)
    await typecheck(c)
    await dryRun(c)
    await runOnFake(c)
  },
})
