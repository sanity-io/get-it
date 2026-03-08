import {createRequester, HttpError} from 'get-it'
import {describe, expect, it} from 'vitest'

describe('as option', () => {
  const request = createRequester({base: 'http://localhost:9980/req-test'})

  it('as: "json" returns parsed JSON body', async () => {
    const res = await request({url: '/json', as: 'json'})
    expect(res.body).toEqual({foo: 'bar'})
    // Should NOT have .json()/.text()/.bytes() methods
    expect('json' in res).toBe(false)
    expect('text' in res).toBe(false)
    expect('bytes' in res).toBe(false)
  })

  it('as: "text" returns string body', async () => {
    const res = await request({url: '/plain-text', as: 'text'})
    expect(typeof res.body).toBe('string')
    expect(res.body).toBe('Just some plain text for you to consume')
  })

  it('as: "stream" returns ReadableStream', async () => {
    const res = await request({url: '/plain-text', as: 'stream'})
    expect(res.body).toBeInstanceOf(ReadableStream)
    // Read the stream to verify content
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let done = false
    while (!done) {
      const result = await reader.read()
      if (result.value) chunks.push(result.value)
      done = result.done
    }
    // Combine chunks and decode
    const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    expect(new TextDecoder().decode(combined)).toBe('Just some plain text for you to consume')
  })

  it('no as: body is Uint8Array with convenience methods', async () => {
    const res = await request('/json')
    expect(res.body).toBeInstanceOf(Uint8Array)
    expect(res.json()).toEqual({foo: 'bar'})
    expect(typeof res.text()).toBe('string')
  })

  it('as: "json" with httpErrors throws on 4xx', async () => {
    await expect(request({url: '/status?code=404', as: 'json'})).rejects.toThrow()
  })

  it('as: "stream" with httpErrors throws on 4xx', async () => {
    await expect(request({url: '/status?code=500', as: 'stream'})).rejects.toThrow()
  })

  it('as: "stream" returns response before body is consumed', async () => {
    const res = await request({url: '/drip', as: 'stream'})
    expect(res.status).toBe(200)
    expect(res.body).toBeInstanceOf(ReadableStream)
    await res.body.cancel()
  })

  it('as: "stream" returns empty ReadableStream when response has no body', async () => {
    const fakeFetch = async () => new Response(null, {status: 204})
    const req = createRequester({fetch: fakeFetch})
    const res = await req({url: 'https://example.com/empty', as: 'stream'})
    expect(res.status).toBe(204)
    expect(res.body).toBeInstanceOf(ReadableStream)
    const reader = res.body.getReader()
    const {done} = await reader.read()
    expect(done).toBe(true)
  })

  it('as: "json" wraps parse failure in TypeError with response context', async () => {
    try {
      await request({url: '/invalid-json', as: 'json'})
      expect.fail('should have thrown')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(TypeError)
      if (err instanceof TypeError) {
        expect(err.message).toContain('/invalid-json')
        expect(err.cause).toBeInstanceOf(SyntaxError)
      }
    }
  })

  it('as: "json" throws HttpError with accessible response on 4xx', async () => {
    try {
      await request({url: '/status?code=404', as: 'json'})
      expect.fail('should have thrown')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(HttpError)
      if (err instanceof HttpError) {
        expect(err.status).toBe(404)
        expect(err.response).toBeDefined()
        expect(err.response.status).toBe(404)
      }
    }
  })

  it('as: "text" throws HttpError on 4xx', async () => {
    await expect(request({url: '/status?code=404', as: 'text'})).rejects.toThrow(HttpError)
  })

  it('as: "text" throws HttpError on 5xx', async () => {
    await expect(request({url: '/status?code=500', as: 'text'})).rejects.toThrow(HttpError)
  })

  it('instance-level as: "json" applies to all requests', async () => {
    const jsonRequest = createRequester({base: 'http://localhost:9980/req-test', as: 'json'})
    const res = await jsonRequest('/json')
    expect(res.body).toEqual({foo: 'bar'})
    expect('json' in res).toBe(false)
  })

  it('per-request as overrides instance-level as', async () => {
    const jsonRequest = createRequester({base: 'http://localhost:9980/req-test', as: 'json'})
    const res = await jsonRequest({url: '/plain-text', as: 'text'})
    expect(typeof res.body).toBe('string')
    expect(res.body).toBe('Just some plain text for you to consume')
  })

  it('as: "stream" throws HttpError with buffered body on error status', async () => {
    try {
      await request({url: '/status?code=500', as: 'stream'})
      expect.fail('should have thrown')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(HttpError)
      if (err instanceof HttpError) {
        expect(err.status).toBe(500)
        expect(typeof err.body).toBe('string')
        expect(err.response).toBeDefined()
      }
    }
  })
})
