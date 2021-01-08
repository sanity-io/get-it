const once = require('lodash.once')
const requester = require('../src/index')
const {debugRequest, baseUrl} = require('./helpers')

describe('aborting requests', () => {
  it('should be able to abort requests', (cb) => {
    const done = once(cb)
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/delay'})

    req.error.subscribe((err) =>
      done(new Error(`error channel should not be called when aborting, got:\n\n${err.message}`))
    )
    req.response.subscribe(() =>
      done(new Error('response channel should not be called when aborting'))
    )

    setTimeout(() => req.abort.publish(), 15)
    setTimeout(() => done(), 250)
  })
})
