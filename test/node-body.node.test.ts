import {createRequester} from 'get-it'
import {createNodeFetch} from 'get-it/node'
import {describe, expect, it} from 'vitest'

const baseUrl = 'http://localhost:9980/req-test'

describe('createNodeFetch request bodies', () => {
  it('sends a ReadableStream body through undici (requires duplex: half)', async () => {
    const request = createRequester({fetch: createNodeFetch()})
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('streamed '))
        controller.enqueue(new TextEncoder().encode('body'))
        controller.close()
      },
    })
    const res = await request({url: `${baseUrl}/echo`, method: 'POST', body: stream})
    expect(res.text()).toBe('streamed body')
  })

  it('sends a Uint8Array body through undici', async () => {
    const request = createRequester({fetch: createNodeFetch()})
    const data = new Uint8Array([0, 1, 2, 127, 128, 255])
    const res = await request({url: `${baseUrl}/echo`, method: 'POST', body: data})
    expect(res.bytes()).toEqual(data)
  })
})
