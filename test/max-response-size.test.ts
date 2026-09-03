import {createRequester, ResponseExceededMaxSizeError} from 'get-it'
import {describe, expect, it} from 'vitest'

function response(...chunks: Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift()
        if (chunk) {
          controller.enqueue(chunk)
        } else {
          controller.close()
        }
      },
    }),
  )
}

const encode = (value: string) => new TextEncoder().encode(value)

describe('maxResponseSize', () => {
  it('rejects buffered responses that exceed the per-request limit', async () => {
    const request = createRequester({fetch: async () => response(encode('hello'), encode('!'))})

    const result = request({url: 'https://example.com', maxResponseSize: 5})

    await expect(result).rejects.toMatchObject({
      name: 'ResponseExceededMaxSizeError',
      message: 'Response content exceeded max size',
    })
    await expect(result).rejects.toBeInstanceOf(ResponseExceededMaxSizeError)
  })

  it('allows a response whose size exactly equals the limit', async () => {
    const request = createRequester({fetch: async () => response(encode('hello'))})

    const result = await request({url: 'https://example.com', maxResponseSize: 5})

    expect(result.text()).toBe('hello')
  })

  it('rejects from Content-Length before reading the body', async () => {
    let cancellationReason: unknown
    const body = new ReadableStream<Uint8Array>({
      cancel(reason) {
        cancellationReason = reason
      },
    })
    const request = createRequester({
      fetch: async () => new Response(body, {headers: {'content-length': '6'}}),
    })

    await expect(request({url: 'https://example.com', maxResponseSize: 5})).rejects.toBeInstanceOf(
      ResponseExceededMaxSizeError,
    )
    expect(cancellationReason).toBeInstanceOf(ResponseExceededMaxSizeError)
  })

  it('does not compare an encoded Content-Length with the decoded body limit', async () => {
    const request = createRequester({
      fetch: async () =>
        new Response(encode('hello'), {
          headers: {'content-encoding': 'gzip', 'content-length': '100'},
        }),
    })

    const result = await request({url: 'https://example.com', maxResponseSize: 5})

    expect(result.text()).toBe('hello')
  })

  it('uses the requester default and allows a per-request override', async () => {
    const request = createRequester({
      fetch: async () => response(encode('hello')),
      maxResponseSize: 4,
    })

    await expect(request('https://example.com')).rejects.toBeInstanceOf(
      ResponseExceededMaxSizeError,
    )
    const unbounded = await request({url: 'https://example.com', maxResponseSize: -1})
    expect(unbounded.text()).toBe('hello')
  })

  it('errors and cancels a streaming response when it crosses the limit', async () => {
    let cancellationReason: unknown
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encode('hello'))
        controller.enqueue(encode('!'))
      },
      cancel(reason) {
        cancellationReason = reason
      },
    })
    const request = createRequester({fetch: async () => new Response(body)})
    const result = await request({
      url: 'https://example.com',
      as: 'stream',
      maxResponseSize: 5,
    })
    const reader = result.body.getReader()

    await expect(reader.read()).resolves.toMatchObject({value: encode('hello'), done: false})
    await expect(reader.read()).rejects.toBeInstanceOf(ResponseExceededMaxSizeError)
    expect(cancellationReason).toBeInstanceOf(ResponseExceededMaxSizeError)
  })

  it('rejects invalid limits', async () => {
    let fetchCalled = false
    const request = createRequester({
      fetch: async () => {
        fetchCalled = true
        return response(encode('hello'))
      },
    })

    await expect(request({url: 'https://example.com', maxResponseSize: -2})).rejects.toThrow(
      'maxResponseSize must be a non-negative integer or -1',
    )
    await expect(request({url: 'https://example.com', maxResponseSize: 1.5})).rejects.toThrow(
      'maxResponseSize must be a non-negative integer or -1',
    )
    expect(fetchCalled).toBe(false)
    expect(() => createRequester({maxResponseSize: -2})).toThrow(
      'maxResponseSize must be a non-negative integer or -1',
    )
  })
})
