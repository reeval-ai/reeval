import { defineEnvironment, evaluate } from 'reeval'
import { podman } from 'reeval/sandbox'

const pod = defineEnvironment('pod', { sandbox: podman() })

evaluate('builds the app', { environments: pod }, async () => {})
