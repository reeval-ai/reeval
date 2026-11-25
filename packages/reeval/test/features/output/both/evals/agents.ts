import { fakeAgent } from 'reeval/agent'

export const writer = fakeAgent({ id: 'writer', files: { 'out.txt': 'hi\n' } })
export const copier = fakeAgent({ id: 'copier', files: { 'out.txt': 'hi\n' } })
export const idler = fakeAgent({ id: 'idler' })
