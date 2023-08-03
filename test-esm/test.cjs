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

  await t.test('get-it/middleware', async () => {
    const middlewares = require('get-it/middleware')
    const entries = Object.entries(middlewares)
    for (const [name, middleware] of entries) {
      assert.equal(typeof middleware, 'function', `${name} is not a function`)
    }
    assert.deepEqual(
      Object.keys(middlewares).sort(),
      Object.keys(await import('get-it/middleware'))
        .filter((name) => name !== 'default')
        .sort(),
      'ESM and CJS exports are not the same',
    )
  })
})
