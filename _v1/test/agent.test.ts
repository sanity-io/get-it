import {environment, getIt} from 'get-it'
import {agent, jsonResponse} from 'get-it/middleware'
import {describe, it} from 'vitest'

import {baseUrl, debugRequest, expectRequestBody} from './helpers'

describe.runIf(environment === 'node')('agent middleware', () => {
  it('can set keepAlive=true', async () => {
    const request = getIt([baseUrl, agent({keepAlive: true}), jsonResponse(), debugRequest])
    const req = request({url: '/debug'})
    await expectRequestBody(req).resolves.toMatchObject({headers: {connection: 'keep-alive'}})
  })

  it('can set keepAlive=false', async () => {
    const request = getIt([baseUrl, agent({keepAlive: false}), jsonResponse(), debugRequest])
    const req = request({url: '/debug'})
    await expectRequestBody(req).resolves.toMatchObject({headers: {connection: 'close'}})
  })
})
