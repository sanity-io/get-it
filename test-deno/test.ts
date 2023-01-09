import {assertEquals, assertExists} from 'https://deno.land/std@0.171.0/testing/asserts.ts'

Deno.test('top-level import', async () => {
  const {getIt} = await import('../dist/index.browser.js')
  console.log({getIt: typeof getIt})
  assertEquals(typeof getIt, 'function')
})

Deno.test('importing package json', async () => {
  const {
    default: {version},
  } = await import('../package.json', {assert: {type: 'json'}})
  assertExists(version)
})

Deno.test('named middleware imports', async () => {
  const {jsonRequest, jsonResponse, httpErrors, headers, promise} = await import(
    '../dist/middleware.browser.js'
  )

  assertEquals(typeof jsonRequest, 'function')
  assertEquals(typeof jsonResponse, 'function')
  assertEquals(typeof httpErrors, 'function')
  assertEquals(typeof headers, 'function')
  assertEquals(typeof promise, 'function')
})
