const test = require('node:test')
const assert = require('node:assert/strict')

test('top-level imports', async (t) => {
  await t.test('get-it', (t) => {
    const {getIt} = require('get-it')
    assert.equal(typeof getIt, 'function')
  })

  await t.test('get-it/package.json', (t) => {
    const {version} = require('get-it/package.json')
    assert.equal(typeof version, 'string')
  })

  await t.test('get-it/middleware', (t) => {
    const middleware = require('get-it/middleware')
    assert.equal(typeof middleware, 'object')
  })
})

test('commonly used imports', async (t) => {
  await t.test('named middleware imports', (t) => {
    const {jsonRequest, jsonResponse, httpErrors, headers, promise} = require('get-it/middleware')
    assert.equal(typeof jsonRequest, 'function')
    assert.equal(typeof jsonResponse, 'function')
    assert.equal(typeof httpErrors, 'function')
    assert.equal(typeof headers, 'function')
    assert.equal(typeof promise, 'function')
  })
})
