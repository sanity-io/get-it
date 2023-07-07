import {environment, getIt} from 'get-it'
import {agent, keepAlive} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {baseUrl, promiseRequest} from './helpers'

describe.runIf(environment === 'node')('keepAlive middleware', () => {
  // This is just verifying that our method of detecting if keepAlive is enabled works.
  it('should be able to detect that keepAlive is disabled', async () => {
    const request = getIt([baseUrl, agent({keepAlive: false})])

    const remotePort1 = (await promiseRequest(request('/remote-port'))).body
    await new Promise((resolve) => setTimeout(resolve, 50))
    const remotePort2 = (await promiseRequest(request('/remote-port'))).body

    expect(remotePort1).not.toBe(remotePort2)
  })

  it('should work with redirects', async () => {
    const request = getIt([baseUrl, keepAlive()])

    const remotePort1 = (await promiseRequest(request('/remote-port'))).body
    await new Promise((resolve) => setTimeout(resolve, 50))
    const remotePort2 = (await promiseRequest(request('/remote-port'))).body

    expect(remotePort1).toBe(remotePort2)
  })

  it('should work without redirects', async () => {
    const request = getIt([baseUrl, keepAlive()])
    const options = {url: '/remote-port', maxRedirects: 0}

    const remotePort1 = (await promiseRequest(request(options))).body
    await new Promise((resolve) => setTimeout(resolve, 50))
    const remotePort2 = (await promiseRequest(request(options))).body

    expect(remotePort1).toBe(remotePort2)
  })
})
