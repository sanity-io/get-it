import {createRequester, type FetchInit} from 'get-it'
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
