import {assert} from 'https://deno.land/std@0.152.0/testing/asserts.ts'

Deno.test('top-level imports', async () => {
  const {default: getIt} = await import('get-it')
  assert(typeof getIt, 'function')

  const {
    default: {version}
  } = await import('get-it/package.json', {assert: {type: 'json'}})
  assert(typeof version, 'string')

  const {default: middleware} = await import('get-it/middleware')
  assert(typeof middleware, 'object')
})
