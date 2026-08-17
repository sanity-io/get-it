import type {FetchFunction} from 'get-it'
import {createRequester, HttpError} from 'get-it'
import {describe, expect, it} from 'vitest'

const finalUrl = 'https://example.com/final'

const redirectedFetch: FetchFunction = async () => {
  const bytes = new TextEncoder().encode('{"ok":true}')
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({'content-type': 'application/json'}),
    url: finalUrl,
    redirected: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
    text: () => Promise.resolve('{"ok":true}'),
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  }
}

describe('response metadata', () => {
  const request = createRequester({fetch: redirectedFetch})

  it('preserves metadata on buffered responses', async () => {
    const response = await request('https://example.com/original')

    expect(response.url).toBe(finalUrl)
    expect(response.redirected).toBe(true)
  })

  it('preserves metadata on JSON responses', async () => {
    const response = await request({url: 'https://example.com/original', as: 'json'})

    expect(response.url).toBe(finalUrl)
    expect(response.redirected).toBe(true)
  })

  it('preserves metadata on text responses', async () => {
    const response = await request({url: 'https://example.com/original', as: 'text'})

    expect(response.url).toBe(finalUrl)
    expect(response.redirected).toBe(true)
  })

  it('preserves metadata on stream responses', async () => {
    const response = await request({url: 'https://example.com/original', as: 'stream'})

    expect(response.url).toBe(finalUrl)
    expect(response.redirected).toBe(true)
    await response.body.cancel()
  })

  it('keeps the requested URL on HttpError and final URL on its response', async () => {
    const failedFetch: FetchFunction = async () => {
      const bytes = new TextEncoder().encode('failed')
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        url: finalUrl,
        redirected: true,
        body: null,
        text: () => Promise.resolve('failed'),
        arrayBuffer: () => Promise.resolve(bytes.buffer),
      }
    }
    const failedRequest = createRequester({fetch: failedFetch})

    try {
      await failedRequest('https://example.com/original')
      expect.fail('request should have failed')
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpError)
      if (error instanceof HttpError) {
        expect(error.url).toBe('https://example.com/original')
        expect(error.response.url).toBe(finalUrl)
        expect(error.response.redirected).toBe(true)
      }
    }
  })
})
