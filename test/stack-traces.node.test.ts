import {createRequest} from 'get-it'
import {createNodeFetch} from 'get-it/node'
import {describe, expect, it} from 'vitest'

/**
 * Extract function names from an Error stack trace.
 * Supports V8 (`at name (file)`), SpiderMonkey and JSC (`name@file`).
 */
function stackNames(error: Error): string[] {
  if (!error.stack) return []
  return error.stack
    .split('\n')
    .map((line) => {
      // V8: "    at funcName (file:line:col)" or "    at Object.funcName (file:line:col)"
      const v8 = line.match(/at (?:Object\.)?(\S+)\s*\(/)
      if (v8) return v8[1]
      // SpiderMonkey/JSC: "funcName@file:line:col" or "async*funcName@file:line:col"
      const sm = line.match(/^(?:async\*)?([^@/<]+)(?:\/<?)?@/)
      if (sm) return sm[1]
      return null
    })
    .filter((name): name is string => name !== null)
}

describe('node fetch stack traces', () => {
  it('network error includes nodeFetch in stack', async () => {
    const request = createRequest({
      fetch: createNodeFetch({proxy: false}),
    })
    try {
      await request({url: 'http://localhost:1/', timeout: 5000})
      expect.fail('should have thrown')
    } catch (err: unknown) {
      if (!(err instanceof Error)) throw err
      expect(stackNames(err)).toContain('nodeFetch')
    }
  })
})
