import {adapter, environment, getIt} from 'get-it'
import {describe, it} from 'vitest'

import {baseUrl, debugRequest} from './helpers'

describe('aborting requests', () => {
  // TODO fix the test in happy-dom
  it.skipIf(environment === 'browser' && adapter === 'xhr')(
    'should be able to abort requests',
    () => {
      return new Promise<void>((resolve, reject) => {
        const request = getIt([baseUrl, debugRequest])
        const req = request({url: '/delay'})

        req.error.subscribe((err: any) =>
          reject(
            new Error(`error channel should not be called when aborting, got:\n\n${err.message}`),
          ),
        )
        req.response.subscribe(() =>
          reject(new Error('response channel should not be called when aborting')),
        )

        setTimeout(() => req.abort.publish(), 15)
        setTimeout(resolve, 250)
      })
    },
  )
})
