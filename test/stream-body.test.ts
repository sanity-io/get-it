import {createRequester, type FetchInit} from 'get-it'
import {asyncIterableBody} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

const url = 'https://example.com/upload'
const encoder = new TextEncoder()

/**
 * Read a streamed request body chunk by chunk. Reading it directly (rather
 * than through `new Response(body)`) keeps the stream's own error intact in
 * every runtime.
 */
async function readText(body: FetchInit['body']): Promise<string> {
  if (!(body instanceof ReadableStream)) return typeof body === 'string' ? body : ''
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  for (;;) {
    const {done, value} = await reader.read()
    if (done) return text + decoder.decode()
    // `ArrayBuffer.isView()` rather than `instanceof`, since jsdom's
    // `TextEncoder` returns a `Uint8Array` from another realm.
    if (!ArrayBuffer.isView(value)) throw new TypeError('Expected a byte chunk')
    text += decoder.decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), {
      stream: true,
    })
  }
}

/** A fetch that records each init and echoes the request body as text. */
function createEchoFetch() {
  const calls: FetchInit[] = []
  const fetch = async (_input: string, init: FetchInit = {}) => {
    calls.push(init)
    return new Response(await readText(init.body))
  }
  return {calls, fetch}
}

describe('streamed request bodies', () => {
  it('sets `duplex: half` for ReadableStream bodies', async () => {
    const {calls, fetch} = createEchoFetch()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('streamed body'))
        controller.close()
      },
    })

    const res = await createRequester({fetch})({url, method: 'POST', body})
    expect(res.text()).toBe('streamed body')
    expect(calls[0]?.duplex).toBe('half')
  })

  it('does not set `duplex` for other bodies', async () => {
    const {calls, fetch} = createEchoFetch()
    const request = createRequester({fetch})
    await request({url, body: 'text'})
    await request({url, body: {json: true}})
    await request({url, body: encoder.encode('bytes')})
    expect(calls.map((init) => 'duplex' in init)).toEqual([false, false, false])
  })
})

describe('asyncIterableBody() middleware', () => {
  /** A fetch that reads the first chunk of the body, then cancels it. */
  async function cancellingFetch(_input: string, init: FetchInit = {}) {
    if (!(init.body instanceof ReadableStream)) throw new TypeError('Expected a stream body')
    const reader = init.body.getReader()
    await reader.read()
    await reader.cancel()
    return new Response('')
  }

  it('is needed for async iterable bodies', async () => {
    const {fetch} = createEchoFetch()
    async function* chunks() {
      yield encoder.encode('body')
    }

    await expect(createRequester({fetch})({url, method: 'POST', body: chunks()})).rejects.toThrow(
      'Unsupported body type: object',
    )
  })

  it('streams async iterable bodies', async () => {
    const {calls, fetch} = createEchoFetch()
    const request = createRequester({fetch, middleware: [asyncIterableBody()]})
    const bytes = encoder.encode('body')
    async function* chunks() {
      yield encoder.encode('streamed ')
      yield new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    }

    const res = await request({url, method: 'POST', body: chunks()})
    expect(res.text()).toBe('streamed body')
    expect(calls[0]?.body).toBeInstanceOf(ReadableStream)
    expect(calls[0]?.duplex).toBe('half')
  })

  it('leaves other bodies alone', async () => {
    const {calls, fetch} = createEchoFetch()
    const request = createRequester({fetch, middleware: [asyncIterableBody()]})
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('web stream'))
        controller.close()
      },
    })

    expect((await request({url, method: 'POST', body: stream})).text()).toBe('web stream')
    expect(calls[0]?.body).toBe(stream)
    expect((await request({url, body: {json: true}})).text()).toBe('{"json":true}')
  })

  it('encodes string chunks as UTF-8', async () => {
    const {fetch} = createEchoFetch()
    const request = createRequester({fetch, middleware: [asyncIterableBody()]})
    async function* chunks() {
      yield 'blåbær'
      yield encoder.encode('syltetøy')
    }

    const res = await request({url, method: 'POST', body: chunks()})
    expect(res.text()).toBe('blåbærsyltetøy')
  })

  it('rejects and closes the source when a chunk is neither bytes nor a string', async () => {
    const {fetch} = createEchoFetch()
    const request = createRequester({fetch, middleware: [asyncIterableBody()]})
    let cleanedUp = false
    async function* chunks() {
      try {
        yield encoder.encode('valid')
        yield {not: 'bytes'}
      } finally {
        cleanedUp = true
      }
    }

    await expect(request({url, method: 'POST', body: chunks()})).rejects.toThrow(
      'Unsupported body chunk: object',
    )
    expect(cleanedUp).toBe(true)
  })

  it('destroys a source that has `destroy()` when a chunk is neither bytes nor a string', async () => {
    const {fetch} = createEchoFetch()
    const request = createRequester({fetch, middleware: [asyncIterableBody()]})
    class InvalidSource {
      destroyed = false
      destroy() {
        this.destroyed = true
      }
      async *[Symbol.asyncIterator]() {
        yield {not: 'bytes'}
      }
    }
    const source = new InvalidSource()

    await expect(request({url, method: 'POST', body: source})).rejects.toThrow(
      'Unsupported body chunk: object',
    )
    expect(source.destroyed).toBe(true)
  })

  it('destroys a source that has `destroy()` when the body is cancelled', async () => {
    class StalledSource {
      destroyed = false
      destroy() {
        this.destroyed = true
      }
      async *[Symbol.asyncIterator]() {
        yield encoder.encode('partial')
        await new Promise(() => {})
      }
    }
    const source = new StalledSource()
    const request = createRequester({fetch: cancellingFetch, middleware: [asyncIterableBody()]})

    await request({url, method: 'POST', body: source})
    expect(source.destroyed).toBe(true)
  })

  it('calls `return()` on other iterators when the body is cancelled', async () => {
    let cleanedUp = false
    async function* chunks() {
      try {
        yield encoder.encode('first')
        yield encoder.encode('second')
      } finally {
        cleanedUp = true
      }
    }
    const request = createRequester({fetch: cancellingFetch, middleware: [asyncIterableBody()]})

    await request({url, method: 'POST', body: chunks()})
    expect(cleanedUp).toBe(true)
  })
})
