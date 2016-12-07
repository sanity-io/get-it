const global = require('global')
const once = require('lodash.once')
const pinkiePromise = require('pinkie-promise')
const {promise, httpErrors} = require('../src/middleware')
const requester = require('../src/index')
const {expect, debugRequest, baseUrl, testNonIE} = require('./helpers')

describe('promise middleware', function () {
  this.timeout(5000)

  const hasPromise = typeof global.Promise !== 'undefined'
  const tests = [
    hasPromise && {name: 'native', impl: promise()},
    {name: 'pinkie', impl: promise({implementation: pinkiePromise})}
  ].filter(Boolean)

  // Test both promise and pinkie-promise in node, recent browsers - only pinkie in older
  tests.forEach(middleware => {
    it(`[${middleware.name}] should turn the return value into a promise`, () => {
      const request = requester([baseUrl, middleware.impl])
      const req = request({url: '/plain-text'})
      return expect(req).to.eventually.containSubset({
        body: 'Just some plain text for you to consume',
        method: 'GET',
        statusCode: 200
      })
    })

    testNonIE(`[${middleware.name}] should reject network errors`, () => {
      const request = requester([baseUrl, middleware.impl])
      const req = request({url: '/permafail'})
      return expect(req).to.eventually.be.rejectedWith(/(socket|network)/i)
    })

    it(`[${middleware.name}] should reject http errors (if middleware is loaded)`, () => {
      const request = requester([baseUrl, httpErrors, middleware.impl])
      const req = request({url: '/status?code=500'})
      return expect(req).to.eventually.be.rejectedWith(/HTTP 500/i)
    })

    it(`[${middleware.name}] can cancel using cancel tokens`, cb => {
      const done = once(cb)
      const source = promise.CancelToken.source()

      const request = requester([baseUrl, middleware.impl])
      request({url: '/delay', cancelToken: source.token})
        .then(() => done(new Error('Should not be resolved when cancelled')))
        .catch(err => {
          if (promise.isCancel(err)) {
            expect(err.toString()).to.equal('Cancel: Cancelled by user')
            done()
            return
          }

          done(new Error(`Should be rejected with cancellation, got:\n\n${err.message}`))
        })

      setTimeout(() => source.cancel('Cancelled by user'), 15)
    })

    it(`[${middleware.name}] does not execute requests that are already cancelled`, cb => {
      const done = once(cb)
      const source = promise.CancelToken.source()
      source.cancel()

      const request = requester([baseUrl, debugRequest, middleware.impl])
      request({url: '/delay', cancelToken: source.token})
        .then(() => done(new Error('Should not be resolved when cancelled')))
        .catch(err => {
          if (promise.isCancel(err)) {
            expect(err.toString()).to.equal('Cancel')
            done()
            return
          }

          done(new Error(`Should be rejected with cancellation, got:\n\n${err.message}`))
        })
    })
  })

  // @todo test timeout errors
  // @todo cancelation
})
