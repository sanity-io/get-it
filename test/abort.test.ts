import {describe, it} from 'vitest'

import {getIt} from '../src/index'
import {baseUrl, debugRequest} from './helpers'

describe('aborting requests', () => {
  it('should be able to abort requests', () => {
    return new Promise<void>((resolve, reject) => {
      const request = getIt([baseUrl, debugRequest])
      const req = request({url: '/delay'})

      req.error.subscribe((err) =>
        reject(
          new Error(`error channel should not be called when aborting, got:\n\n${err.message}`)
        )
      )
      req.response.subscribe(() =>
        reject(new Error('response channel should not be called when aborting'))
      )

      setTimeout(() => req.abort.publish(), 15)
      setTimeout(resolve, 250)
    })
  })
})
