import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

// The calls tree.eval.ts's declaration tree stands for: the two plan alike.
const built = defineEnvironment('built', {
  sandbox: docker({ dockerfile: '../docker/Dockerfile' }),
})
const own = defineEnvironment('own', { sandbox: docker({ dockerfile: './images/Dockerfile' }) })

export default defineEval({
  sandbox: docker({ dockerfile: './images/Dockerfile' }),
  task: async () => {},
})
