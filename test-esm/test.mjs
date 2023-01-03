import test from 'node:test'
import assert from 'node:assert/strict'

test('top-level imports', async (t) => {
  await t.test('get-it', async (t) => {
    const {getIt} = await import('get-it')
    assert.equal(typeof getIt, 'function')
  })

  await t.test('get-it/package.json', async (t) => {
    const {
      default: {version},
    } = await import('get-it/package.json', {assert: {type: 'json'}})
    assert.equal(typeof version, 'string')
  })

  await t.test('get-it/middleware', async (t) => {
    const {base} = await import('get-it/middleware')
    assert.equal(typeof base, 'function')
  })
})

test('commonly used imports', async (t) => {
  await t.test('named middleware imports', async (t) => {
    const {jsonRequest, jsonResponse, httpErrors, headers, promise} = await import(
      'get-it/middleware'
    )
    assert.equal(typeof jsonRequest, 'function')
    assert.equal(typeof jsonResponse, 'function')
    assert.equal(typeof httpErrors, 'function')
    assert.equal(typeof headers, 'function')
    assert.equal(typeof promise, 'function')
  })
})
