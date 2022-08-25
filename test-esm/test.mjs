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
    const {base} = await import('get-it/middleware')
    assert.equal(typeof base, 'function')
  })
})

test('commonly used imports', async t => {
  await t.test('named middleware imports', async t => {
    const {jsonRequest, jsonResponse, httpErrors, headers, promise} = await import('get-it/middleware')
    assert.equal(typeof jsonRequest, 'function')
    assert.equal(typeof jsonResponse, 'function')
    assert.equal(typeof httpErrors, 'function')
    assert.equal(typeof headers, 'function')
    assert.equal(typeof promise, 'function')
  })

  await t.test('direct middleware imports', async t => {
    // https://github.com/sanity-io/client/blob/428bc53ab4d9879baf466030e0fc9e048e9eb9ef/src/http/request.js#L3-L7
    const {default: observable} = await import('get-it/lib/middleware/observable')
    const {default: jsonRequest} = await import('get-it/lib/middleware/jsonRequest')
    const {default: jsonResponse} = await import('get-it/lib/middleware/jsonResponse')
    const {default: progress} = await import('get-it/lib/middleware/progress')

    assert.equal(typeof observable, 'function')
    assert.equal(typeof jsonRequest, 'function')
    assert.equal(typeof jsonResponse, 'function')
    assert.equal(typeof progress, 'function')
  })

  await t.test('direct lib-node middleware imports', async t => {
    // https://github.com/sanity-io/client/blob/428bc53ab4d9879baf466030e0fc9e048e9eb9ef/src/http/nodeMiddleware.js#L1-L3
    const {default: retry} = await import('get-it/lib-node/middleware/retry')
    const {default: debug} = await import('get-it/lib-node/middleware/debug')
    const {default: headers} = await import('get-it/lib-node/middleware/headers')

    assert.equal(typeof retry, 'function')
    assert.equal(typeof debug, 'function')
    assert.equal(typeof headers, 'function')
  })
})
