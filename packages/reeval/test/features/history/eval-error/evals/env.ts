import { defineEnvironment } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox = process.env.REEVAL_FIXTURE_SANDBOX === 'docker' ? docker() : fakeSandbox()

export const plain = defineEnvironment('plain', { sandbox })
