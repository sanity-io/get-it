import {createRequester} from 'get-it'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

// Real-request coverage for `redirect: 'manual'` against an actual 302.
// The pass-through tests in built-ins.test.ts assert the option reaches fetch;
// this asserts get-it surfaces the runtime's real response without choking on
// either shape. The observed behavior splits cleanly:
//
//   - Real browsers (Chromium/Firefox/WebKit) return an opaque-redirect
//     filtered response per the Fetch spec: status 0, headers stripped.
//   - Every non-browser runtime (Node/undici, Bun, Deno, edge runtimes,
//     workers) and the happy-dom simulation return the real 3xx response
//     with readable headers.
//
// We branch on the response signature (status 0 == opaque) rather than
// sniffing the environment, so the same test asserts the correct contract
// wherever it runs.
describe('createRequester - redirect: manual', () => {
  const request = createRequester()

  it('surfaces the runtime redirect response without throwing', async () => {
    const res = await request({
      url: `${baseUrl}/redirect?n=0`,
      redirect: 'manual',
      httpErrors: false,
    })

    if (res.status === 0) {
      // Opaque-redirect response (real browsers): nothing is readable.
      expect(res.headers.get('location')).toBeNull()
      expect([...res.headers.keys()]).toHaveLength(0)
    } else {
      // Real 3xx response (all non-browser runtimes): headers are readable
      // and the redirect was not followed.
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/req-test/redirect?n=1')
    }
  })
})
