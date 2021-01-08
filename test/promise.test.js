const once = require('lodash.once')
const {promise, httpErrors} = require('../src/middleware')
const requester = require('../src/index')
const {expect, debugRequest, baseUrl, testNonIE} = require('./helpers')

describe('promise middleware', function () {
  this.timeout(5000)

  it('should turn the return value into a promise', () => {
    const request = requester([baseUrl, promise()])
    const req = request({url: '/plain-text'})
    return expect(req).to.eventually.containSubset({
      body: 'Just some plain text for you to consume',
      method: 'GET',
      statusCode: 200,
    })
  })

  it('should be able to resolve only the response body', () => {
    const request = requester([baseUrl, promise({onlyBody: true})])
    const req = request({url: '/plain-text'})
    return expect(req).to.eventually.equal('Just some plain text for you to consume')
  })

  testNonIE('should reject network errors', () => {
    const request = requester([baseUrl, promise()])
    const req = request({url: '/permafail'})
    return expect(req).to.eventually.be.rejectedWith(/(socket|network)/i)
  })

  it('should reject http errors (if middleware is loaded)', () => {
    const request = requester([baseUrl, httpErrors(), promise()])
    const req = request({url: '/status?code=500'})
    return expect(req).to.eventually.be.rejectedWith(/HTTP 500/i)
  })

  it('can cancel using cancel tokens', (cb) => {
    const done = once(cb)
    const source = promise.CancelToken.source()

    const request = requester([baseUrl, promise()])
    request({url: '/delay', cancelToken: source.token})
      .then(() => done(new Error('Should not be resolved when cancelled')))
      .catch((err) => {
        if (promise.isCancel(err)) {
          expect(err.toString()).to.equal('Cancel: Cancelled by user')
          done()
          return
        }

        done(new Error(`Should be rejected with cancellation, got:\n\n${err.message}`))
      })

    setTimeout(() => source.cancel('Cancelled by user'), 15)
  })

  it('does not execute requests that are already cancelled', (cb) => {
    const done = once(cb)
    const source = promise.CancelToken.source()
    source.cancel()

    const request = requester([baseUrl, debugRequest, promise()])
    request({url: '/delay', cancelToken: source.token})
      .then(() => done(new Error('Should not be resolved when cancelled')))
      .catch((err) => {
        if (promise.isCancel(err)) {
          expect(err.toString()).to.equal('Cancel')
          done()
          return
        }

        done(new Error(`Should be rejected with cancellation, got:\n\n${err.message}`))
      })
  })

  // @todo test timeout errors
  // @todo cancelation
})
