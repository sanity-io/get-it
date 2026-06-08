import {createRequester} from 'get-it'

Deno.test('imports get-it in Deno and uses the default fetch transport', async () => {
  const request = createRequester({timeout: false})
  const response = await request({url: 'data:text/plain,hello%20from%20deno', as: 'text'})

  if (response.body !== 'hello from deno') {
    throw new Error(`Expected response body to be "hello from deno", got "${response.body}"`)
  }
})
