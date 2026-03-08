import {createRequest} from 'get-it'
import {createNodeFetch} from 'get-it/node'
import {describe, expect, it} from 'vitest'

/**
 * Extract function names from an Error stack trace.
 */
function stackNames(error: Error): string[] {
  if (!error.stack) return []
  return error.stack
    .split('\n')
    .map((line) => {
      const match = line.match(/at (?:Object\.)?(\S+)\s*\(/)
      return match ? match[1] : null
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
