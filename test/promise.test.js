const global = require('global')
const pinkiePromise = require('pinkie-promise')
const {promise} = require('../src/middleware')
const requester = require('../src/index')
const {expect, baseUrl} = require('./helpers')

describe('promise middleware', () => {
  const hasPromise = typeof global.Promise !== 'undefined'
  const tests = [
    hasPromise && promise(),
    promise({implementation: pinkiePromise})
  ].filter(Boolean)

  // Test both promise and pinkie-promise in node, recent browsers - only pinkie in older
  tests.forEach(middleware => {
    it('should turn the return value into a promise', () => {
      const request = requester([baseUrl, promise()])
      const req = request({url: '/plain-text'})
      return expect(req).to.eventually.containSubset({
        body: 'Just some plain text for you to consume',
        method: 'GET',
        statusCode: 200
      })
    })

    it('should reject errors', () => {
      const request = requester([baseUrl, promise()])
      const req = request({url: '/permafail'})
      return expect(req).to.eventually.be.rejectedWith(/(socket|network)/i)
    })
  })

  // @todo test timeout errors
  // @todo cancelation
})
