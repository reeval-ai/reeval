import { defineEnvironment } from 'reeval'
import { docker } from 'reeval/sandbox'

export const kvm = defineEnvironment('kvm', { sandbox: docker({ devices: ['kvm'] }) })

/** For the canary: the same container without the device. */
export const plain = defineEnvironment('plain', { sandbox: docker() })

/** Opens /dev/kvm read-write as the sandbox user. */
export const OPEN_KVM = '( : <> /dev/kvm ) 2>/dev/null && echo opened || echo refused'
