import {PassThrough} from 'node:stream'

import {createRequester} from 'get-it'
import {asyncIterableBody} from 'get-it/middleware'

Deno.test('imports get-it in Deno and uses the default fetch transport', async () => {
  const request = createRequester({timeout: false})
  const response = await request({url: 'data:text/plain,hello%20from%20deno', as: 'text'})

  if (response.body !== 'hello from deno') {
    throw new Error(`Expected response body to be "hello from deno", got "${response.body}"`)
  }
})

Deno.test('sends a Node.js stream body as a native Request body', async () => {
  // Building a real `Request` makes Deno validate the init (stream body and
  // `duplex`) and read the stream, without needing network access.
  const request = createRequester({
    timeout: false,
    middleware: [asyncIterableBody()],
    fetch: async (input, init) => new Response(await new Request(input, init).text()),
  })
  const body = new PassThrough()
  body.end('hello from a node stream')
  const response = await request({url: 'https://example.com/', method: 'POST', body, as: 'text'})

  if (response.body !== 'hello from a node stream') {
    throw new Error(`Expected the request body to be echoed, got "${response.body}"`)
  }
})
