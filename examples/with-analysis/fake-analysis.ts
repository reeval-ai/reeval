// A stand-in for the analysis model: it answers from the digest's facts and cites them by id, as a
// model must, so its sentences go through reeval's checks with no key.
type Digest = { facts: { id: string; kind: string; cells?: { pass: string }[] }[] }

/** `reeval explain`'s answer: a TL;DR and one result, citing the digest's pass@1 fact. */
export function output(digest: Digest) {
  const pass = digest.facts.find((f) => f.kind === 'pass@1')
  const all = pass?.cells?.every((c) => c.pass.split('/')[0] === c.pass.split('/')[1])
  const text = all ? 'The agent adds a tested multiply on every trial.' : 'Some trials fail.'
  return {
    tldr: text,
    whatHappened: [],
    results: pass ? [{ text, cites: [pass.id], confidence: 'high' }] : [],
    why: [],
    anomalies: [],
    actions: [],
    confidence: { overall: 'medium', why: 'A few trials, on a fake agent.' },
  }
}
