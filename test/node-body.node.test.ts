import {createRequester} from 'get-it'
import {createNodeFetch} from 'get-it/node'
import {describe, expect, it} from 'vitest'

import {createRequester as createNodeRequester} from '../src/_exports/index.node'

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

describe.each([
  {name: 'default Node entry', createRequest: () => createNodeRequester()},
  {
    name: 'explicit Node fetch',
    createRequest: () => createRequester({fetch: createNodeFetch({proxy: false})}),
  },
  {
    name: 'proxied Node fetch',
    createRequest: () =>
      createRequester({fetch: createNodeFetch({proxy: 'http://localhost:4000'})}),
  },
])('$name multipart bodies', ({createRequest}) => {
  it('encodes native FormData fields and files as multipart', async () => {
    const request = createRequest()
    const form = new FormData()
    form.append('field', 'first')
    form.append('empty', '')
    form.append('field', 'second 🎉')
    form.append('file', new File(['file contents 🌍'], 'original.txt', {type: 'text/plain'}))
    form.append('blob', new Blob(['blob contents'], {type: 'text/plain'}), 'custom.txt')

    const res = await request<{
      headers: Record<string, string>
      method: string
      body: string
    }>({url: `${baseUrl}/debug`, body: form, as: 'json'})

    expect(res.body.method).toBe('POST')
    expect(res.body.headers['content-type']).toMatch(/^multipart\/form-data; boundary=.+/)
    const received = await new Response(res.body.body, {headers: res.body.headers}).formData()
    expect(Array.from(received.keys())).toEqual(['field', 'empty', 'field', 'file', 'blob'])
    expect(received.getAll('field')).toEqual(['first', 'second 🎉'])
    expect(received.get('empty')).toBe('')
    for (const [key, contents] of [
      ['file', 'file contents 🌍'],
      ['blob', 'blob contents'],
    ]) {
      const file = received.get(key)
      const original = form.get(key)
      if (file === null || typeof file === 'string') throw new Error(`Missing file: ${key}`)
      if (original === null || typeof original === 'string') {
        throw new Error(`Missing original file: ${key}`)
      }
      expect(file.name).toBe(original.name)
      expect(file.type).toBe(original.type)
      expect(await file.text()).toBe(contents)
    }
    expect(Array.from(form.keys())).toEqual(Array.from(received.keys()))
    expect(form.getAll('field')).toEqual(['first', 'second 🎉'])
  })

  it('encodes an empty native FormData as multipart', async () => {
    const res = await createRequest()<{headers: Record<string, string>; body: string}>({
      url: `${baseUrl}/debug`,
      body: new FormData(),
      as: 'json',
    })

    expect(res.body.headers['content-type']).toMatch(/^multipart\/form-data; boundary=.+/)
    const received = await new Response(res.body.body, {headers: res.body.headers}).formData()
    expect(Array.from(received)).toEqual([])
  })
})
