import test from 'node:test'
import assert from 'node:assert/strict'

test('top-level imports', async t => {
  await t.test('get-it', async t => {
    const {default: getIt} = await import('get-it')
    assert.equal(typeof getIt, 'function')
  })

  await t.test('get-it/package.json', async t => {
    const {default: {version}} = await import('get-it/package.json', {assert: {type: 'json'}})
    assert.equal(typeof version, 'string')
  })

  await t.test('get-it/middleware', async t => {
    const {default: middleware} = await import('get-it/middleware')
    assert.equal(typeof middleware, 'object')
  })
})
