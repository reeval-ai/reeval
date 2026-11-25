import { defineEval, expect } from 'reeval'
import { AxiosLike, Holder, TokenError } from './classes.ts'
import { plain } from './env.ts'
import { COMMAND, PASSPHRASE, TOKEN } from './token.ts'

// The matcher compares the real instances; only what a failure quotes is masked.
export default defineEval({
  environment: plain,
  task: async (c) => {
    const r = await c.exec(...COMMAND)
    expect(new TokenError(r.stdout)).toEqual(new TokenError(`nope ${TOKEN}`))
    expect(new Holder(PASSPHRASE)).toEqual(new Holder(PASSPHRASE))
    expect(new AxiosLike(TOKEN).toJSON()).toEqual({ message: TOKEN, code: 'ERR_BAD_REQUEST' })
  },
})
