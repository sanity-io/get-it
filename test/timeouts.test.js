const once = require('lodash.once')
const requester = require('../src/index')
const {expect, debugRequest, baseUrl} = require('./helpers')

describe('timeouts', function () {
  this.timeout(10000)

  it('should be able to set a "global" timeout', (cb) => {
    // To prevent the connection from being established use a non-routable IP
    // address. See https://tools.ietf.org/html/rfc5737#section-3
    const done = once(cb)
    const request = requester([debugRequest])
    const req = request({url: 'http://192.0.2.1/', timeout: 250})

    req.response.subscribe(() => done(new Error('response channel should not be called')))
    req.error.subscribe((err) => {
      expect(err.message).to.match(/timed out/i)
      done()
    })
  })

  it('should be able to set individual timeouts', (cb) => {
    const done = once(cb)
    const request = requester([debugRequest])
    const startTime = Date.now()
    const req = request({url: 'http://192.0.2.1/', timeout: {socket: 250, connect: 450}})

    req.response.subscribe(() => done(new Error('response channel should not be called')))
    req.error.subscribe(() => {
      expect(Date.now() - startTime).to.be.above(250)
      done()
    })
  })

  it.skip('should be able to set socket timeout', (cb) => {
    const done = once(cb)
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/stall-after-initial', timeout: {socket: 500, connect: 250}})

    req.response.subscribe(() => done(new Error('response channel should not be called')))
    req.error.subscribe((err) => {
      expect(err.message).to.match(/socket timed out/i)
      expect(err.code).to.equal('ESOCKETTIMEDOUT')
      done()
    })
  })
})
