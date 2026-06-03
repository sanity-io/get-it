import {createRequester} from 'get-it'
import {retry} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

/**
 * In v8, get-it shipped a `keepAlive` middleware that managed a Node HTTP agent
 * with keep-alive enabled and retried `ECONNRESET` errors caused by the server
 * closing a pooled socket at an unfortunate time (issue #576):
 *
 * > When sending request through a keep-alive enabled agent, the underlying
 * > socket might be reused. But if server closes connection at unfortunate
 * > time, client may run into a 'ECONNRESET' error. We retry [...] in case of
 * > ECONNRESET error.
 *
 * v8 could retry that safely (even for non-idempotent methods) because raw
 * `http.request` exposes `req.reusedSocket`, proving the request was sent on a
 * pooled socket and therefore never reached a live server.
 *
 * In v9 the transport is `fetch` (undici in Node), which keeps connections
 * alive by default. Two things changed:
 *
 *  - undici manages the connection pool itself and will not dispatch a request
 *    onto a socket the peer has closed, so the specific reused-socket race from
 *    #576 no longer surfaces (verified: forcibly RST-ing an idle pooled socket
 *    and immediately reusing it makes undici transparently reconnect).
 *  - `fetch` exposes no `reusedSocket` signal, so a connection reset cannot be
 *    proven to predate the request reaching the server (a POST may have been
 *    processed before the connection dropped). Retrying connection resets is
 *    therefore left to the opt-in `retry` middleware, which is gated to
 *    idempotent methods — the only retry that is safe when we can't be sure.
 */
describe('keep-alive (connection reuse) [node]', {timeout: 15000}, () => {
  it('reuses the underlying socket across requests by default', async () => {
    const request = createRequester({base: baseUrl})

    // `/remote-port` echoes `req.socket.remotePort`; an identical port across
    // two sequential requests proves the same TCP socket was reused, i.e.
    // keep-alive is active without any middleware.
    const port1 = (await request('/remote-port')).text()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const port2 = (await request('/remote-port')).text()

    expect(port1).toBe(port2)
  })

  it('retries a connection reset on an idempotent request via retry middleware (#576)', async () => {
    const request = createRequester({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 25})],
    })

    // `/fail` destroys the connection on the first attempt before succeeding.
    // The client observes `UND_ERR_SOCKET` ("other side closed") / `ECONNRESET`.
    // The retry middleware recovers on a fresh connection.
    const res = await request(`/fail?uuid=keepalive-reset-${Math.random()}&n=2`)

    expect(res.status).toBe(200)
    expect(res.text()).toBe('Success after failure')
  })

  it('does not retry the reset without the retry middleware', async () => {
    const request = createRequester({base: baseUrl, httpErrors: false})

    // undici does not auto-retry an in-flight reset, so without the retry
    // middleware the error propagates to the caller.
    await expect(request(`/fail?uuid=keepalive-noretry-${Math.random()}&n=2`)).rejects.toThrow()
  })

  it('does not retry non-idempotent methods even with retry middleware', async () => {
    const request = createRequester({
      base: baseUrl,
      httpErrors: false,
      middleware: [retry({retryDelay: () => 10})],
    })

    // A POST may have been processed before the connection dropped, so a reset
    // is not safe to retry; the middleware leaves non-idempotent methods alone.
    await expect(
      request({url: `/fail?uuid=keepalive-post-${Math.random()}&n=2`, method: 'POST', body: 'x'}),
    ).rejects.toThrow()
  })
})
