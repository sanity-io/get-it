import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'

import {getIt} from 'get-it'
import * as middlewares from 'get-it/middleware'

const require = createRequire(import.meta.url)

test('top-level imports', async (t) => {
  await t.test('get-it', async () => {
    assert.equal(typeof getIt, 'function')
  })

  await t.test('get-it/package.json', async () => {
    const {
      default: {version},
    } = await import('get-it/package.json', {with: {type: 'json'}})
    assert.equal(typeof version, 'string')
  })

  await t.test('get-it/middleware', async () => {
    for (const [name, middleware] of Object.entries(middlewares)) {
      assert.equal(typeof middleware, 'function', `${name} is not a function`)
    }
    assert.deepEqual(
      Object.keys(middlewares).sort(),
      Object.keys(require('get-it/middleware')).sort(),
      'ESM and CJS exports are not the same',
    )
  })
})
