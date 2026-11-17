import { defineEnvironment } from 'reeval'
import { docker } from 'reeval/sandbox'

export const vm = defineEnvironment('vm', { sandbox: docker(), egress: 'allow-all' })

/** Holds the attempt on its machine past a few of the run's 1s heartbeats. */
export const HOLD = 'sleep 3 && echo held'
