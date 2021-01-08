const once = require('lodash.once')
const zenObservable = require('zen-observable')
const {promise, observable} = require('../src/middleware')
const rateLimit = require('../src/middleware/rateLimit')
const requester = require('../src/index')
const {expect, baseUrl, testNonIE} = require('./helpers')

const options = {rate: 1, interval: 500, maxDelay: 750}
const obsOptions = {implementation: zenObservable}

describe('rate limit middleware', function () {
  this.timeout(15000)

  it('should give understandable error if mounting after promise/observable', () => {
    const request = requester([baseUrl, promise(), rateLimit(options)])
    expect(() => {
      request({url: '/plain-text'})
    }).to.throw('Rate limit middleware must be called before promise/observable middlewares')
  })

  it('should work with promise middleware', () => {
    const start = Date.now()
    const request = requester([baseUrl, rateLimit(options), promise()])
    const req1 = request({url: '/plain-text'})
    const req2 = request({url: '/plain-text'})
    return Promise.all([
      expect(req1).to.eventually.containSubset({
        body: 'Just some plain text for you to consume',
        statusCode: 200,
      }),
      expect(req2).to.eventually.containSubset({
        body: 'Just some plain text for you to consume',
        statusCode: 200,
      }),
    ]).then(() => {
      expect(Date.now() - start).to.be.greaterThan(500)
    })
  })

  it('should throw on max delay reached', () => {
    const request = requester([baseUrl, rateLimit(options), promise()])
    const req1 = request({url: '/plain-text'})
    const req2 = request({url: '/plain-text'})
    const req3 = request({url: '/plain-text'})
    return Promise.all([
      expect(req1).to.eventually.containSubset({statusCode: 200}),
      expect(req2).to.eventually.containSubset({statusCode: 200}),
      expect(req3).to.eventually.containSubset({statusCode: 200}),
    ])
      .then(() => {
        throw new Error('Should have failed when reaching max delay')
      })
      .catch((err) => {
        expect(err.message).to.include('Rate limit max delay reached')
      })
  })

  testNonIE('should reject network errors with promise middleware', () => {
    const request = requester([baseUrl, rateLimit(options), promise()])
    const req = request({url: '/permafail'})
    return expect(req).to.eventually.be.rejectedWith(/(socket|network)/i)
  })

  it('should work with observable middleware', (done) => {
    const request = requester([baseUrl, rateLimit(options), observable(obsOptions)])

    const start = Date.now()
    const responses = []

    request({url: '/plain-text'})
      .filter((ev) => ev.type === 'response')
      .subscribe(onResponse)

    request({url: '/plain-text'})
      .filter((ev) => ev.type === 'response')
      .subscribe(onResponse)

    function onResponse(res) {
      if (responses.push(res) !== 2) {
        return
      }

      expect(Date.now() - start).to.be.greaterThan(500)

      expect(responses[0]).to.containSubset({
        body: 'Just some plain text for you to consume',
        statusCode: 200,
      })

      expect(responses[1]).to.containSubset({
        body: 'Just some plain text for you to consume',
        statusCode: 200,
      })

      done()
    }
  })

  it('should cancel the request when unsubscribing from observable', (cb) => {
    const done = once(cb)
    const request = requester([baseUrl, rateLimit(options), observable(obsOptions)])
    const subscriber = request({url: '/delay'}).subscribe({
      next: (res) => done(new Error('response channel should not be called when aborting')),
      error: (err) =>
        done(new Error(`error channel should not be called when aborting, got:\n\n${err.message}`)),
    })

    setTimeout(() => subscriber.unsubscribe(), 15)
    setTimeout(() => done(), 250)
  })
})
