import {environment, getIt} from 'get-it'
import {agent, jsonResponse} from 'get-it/middleware'
import {describe, it} from 'vitest'

import {baseUrl, debugRequest, expectRequestBody} from './helpers'

describe.runIf(environment === 'node')('agent middleware', () => {
  it('can be used to override keep-alive', async () => {
    // First see that by default we're using keep-alive:
    {
      const request = getIt([baseUrl, jsonResponse(), debugRequest])
      const req = request({url: '/debug'})
      await expectRequestBody(req).resolves.toMatchObject({headers: {connection: 'keep-alive'}})
    }

    // ... but with our custom agent we can change it to close:
    {
      const request = getIt([baseUrl, agent({keepAlive: false}), jsonResponse(), debugRequest])
      const req = request({url: '/debug'})
      await expectRequestBody(req).resolves.toMatchObject({headers: {connection: 'close'}})
    }
  })
})
