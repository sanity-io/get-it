const global = require('global')
const pinkiePromise = require('pinkie-promise')
const {promise, httpErrors} = require('../src/middleware')
const requester = require('../src/index')
const {expect, baseUrl, testNonIE} = require('./helpers')

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
  })

  // @todo test timeout errors
  // @todo cancelation
})
