import {environment, getIt} from 'get-it'
import {keepAlive} from 'get-it/middleware'
import {describe, it} from 'vitest'

import {baseUrl, promiseRequest} from './helpers'

describe.runIf(environment === 'node')('socket', () => {
  process.on('warning', (e) => {
    if (e.name === 'MaxListenersExceededWarning') {
      throw e
    }
  })

  it(`doesn't leak handlers`, async () => {
    const request = getIt([baseUrl])

    for (let i = 0; i < 100; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      ;(await promiseRequest(request('/remote-port'))).body
    }
  })

  it(`doesn't leak handlers, with keep alive`, async () => {
    const request = getIt([baseUrl, keepAlive()])

    for (let i = 0; i < 100; i++) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      ;(await promiseRequest(request('/remote-port'))).body
    }
  })

  it(`doesn't leak handlers with many concurrent requests`, async () => {
    const request = getIt([baseUrl, keepAlive()])

    const promises = []
    for (let i = 0; i < 1000; i++) {
      promises.push(promiseRequest(request('/delay')))
    }
    await Promise.all(promises)
  })
})
