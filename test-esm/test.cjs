const test = require('node:test')
const assert = require('node:assert/strict')

test('top-level imports', async t => {
  await t.test('get-it', t => {
    const getIt = require('get-it')
    assert.equal(typeof getIt, 'function')
  })

  await t.test('get-it/package.json', t => {
    const {version} = require('get-it/package.json')
    assert.equal(typeof version, 'string')
  })

  await t.test('get-it/middleware', t => {
    const middleware = require('get-it/middleware')
    assert.equal(typeof middleware, 'object')
  })
})

test('commonly used imports', async t => {
  await t.test('named middleware imports', t => {
    const {jsonRequest, jsonResponse, httpErrors, headers, promise} = require('get-it/middleware')
    assert.equal(typeof jsonRequest, 'function')
    assert.equal(typeof jsonResponse, 'function')
    assert.equal(typeof httpErrors, 'function')
    assert.equal(typeof headers, 'function')
    assert.equal(typeof promise, 'function')
  })

  await t.test('direct middleware imports', t => {
    // https://github.com/sanity-io/client/blob/428bc53ab4d9879baf466030e0fc9e048e9eb9ef/src/http/request.js#L3-L7
    const observable = require('get-it/lib/middleware/observable')
    const jsonRequest = require('get-it/lib/middleware/jsonRequest')
    const jsonResponse = require('get-it/lib/middleware/jsonResponse')
    const progress = require('get-it/lib/middleware/progress')

    assert.equal(typeof observable, 'function')
    assert.equal(typeof jsonRequest, 'function')
    assert.equal(typeof jsonResponse, 'function')
    assert.equal(typeof progress, 'function')
  })

  await t.test('direct lib-node middleware imports', t => {
    // https://github.com/sanity-io/client/blob/428bc53ab4d9879baf466030e0fc9e048e9eb9ef/src/http/nodeMiddleware.js#L1-L3
    const retry = require('get-it/lib-node/middleware/retry')
    const debug = require('get-it/lib-node/middleware/debug')
    const headers = require('get-it/lib-node/middleware/headers')

    assert.equal(typeof retry, 'function')
    assert.equal(typeof debug, 'function')
    assert.equal(typeof headers, 'function')
  })
})

test('comprehensive test that checks that adding pkg.exports does not break backwards compatibility in any of the imports', t => {
  // If the import is not allowed it'll throw
  assert.doesNotThrow(() => require('get-it/index'))
  assert.doesNotThrow(() => require('get-it/index.js'))
  assert.doesNotThrow(() => require('get-it/middleware.js'))
  assert.doesNotThrow(() => require('get-it/lib'))
  assert.doesNotThrow(() => require('get-it/lib/index.js'))
  assert.doesNotThrow(() => require('get-it/lib/middleware/index'))
  assert.doesNotThrow(() => require('get-it/lib/middleware/index.js'))
  assert.doesNotThrow(() => require('get-it/lib/middleware/cancel/Cancel.js'))
  assert.doesNotThrow(() => require('get-it/lib/middleware/progress/index'))
  assert.doesNotThrow(() => require('get-it/lib/middleware/progress/index.js'))
  assert.doesNotThrow(() => require('get-it/lib/request'))
  assert.doesNotThrow(() => require('get-it/lib/request/index'))
  assert.doesNotThrow(() => require('get-it/lib/request/index.js'))
  assert.doesNotThrow(() => require('get-it/lib/request/browser/fetchXhr'))
  assert.doesNotThrow(() => require('get-it/lib/request/browser/fetchXhr.js'))
  assert.doesNotThrow(() => require('get-it/lib/request/node/proxy'))
  assert.doesNotThrow(() => require('get-it/lib/request/node/proxy.js'))
  assert.doesNotThrow(() => require('get-it/lib/util/global'))
  assert.doesNotThrow(() => require('get-it/lib/util/global.js'))
  assert.doesNotThrow(() => require('get-it/lib-node'))
  assert.doesNotThrow(() => require('get-it/lib-node/index.js'))
  assert.doesNotThrow(() => require('get-it/lib-node/middleware/index'))
  assert.doesNotThrow(() => require('get-it/lib-node/middleware/index.js'))
  assert.doesNotThrow(() => require('get-it/lib-node/middleware/cancel/Cancel.js'))
  assert.doesNotThrow(() => require('get-it/lib-node/middleware/progress/index'))
  assert.doesNotThrow(() => require('get-it/lib-node/middleware/progress/index.js'))
  assert.doesNotThrow(() => require('get-it/lib-node/request'))
  assert.doesNotThrow(() => require('get-it/lib-node/request/index'))
  assert.doesNotThrow(() => require('get-it/lib-node/request/index.js'))
  assert.doesNotThrow(() => require('get-it/lib-node/request/browser/fetchXhr'))
  assert.doesNotThrow(() => require('get-it/lib-node/request/browser/fetchXhr.js'))
  assert.doesNotThrow(() => require('get-it/lib-node/request/node/proxy'))
  assert.doesNotThrow(() => require('get-it/lib-node/request/node/proxy.js'))
  assert.doesNotThrow(() => require('get-it/lib-node/util/global'))
  assert.doesNotThrow(() => require('get-it/lib-node/util/global.js'))
  assert.doesNotThrow(() => require('get-it/umd/get-it'))
  assert.doesNotThrow(() => require('get-it/umd/get-it.js'))
})
