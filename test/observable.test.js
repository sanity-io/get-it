const once = require('lodash.once')
const {observable, httpErrors} = require('../src/middleware')
const requester = require('../src/index')
const {expect, baseUrl} = require('./helpers')

describe('observable middleware', () => {
  it('should turn the return value into an observable', done => {
    const request = requester([baseUrl, observable])
    request({url: '/plain-text'})
      .filter(ev => ev.type === 'response')
      .map(ev => ev.response)
      .subscribe(res => {
        expect(res).to.containSubset({
          body: 'Just some plain text for you to consume',
          method: 'GET',
          statusCode: 200
        })

        done()
      })
  })

  it('should trigger error handler on failures', done => {
    const request = requester([baseUrl, httpErrors, observable])
    request({url: '/status?code=500'}).subscribe({
      next: () => done(new Error('next() called when error() should have been')),
      error: err => {
        expect(err.message).to.match(/HTTP 500/i)
        done()
      }
    })
  })

  it('should not trigger request unless subscribe is called', done => {
    const onRequest = () => done(new Error('Request triggered without subscribe()'))
    const request = requester([baseUrl, observable, {onRequest}])
    request({url: '/plain-text'})
    setTimeout(() => done(), 100)
  })

  it('should cancel the request when unsubscribing from observable', cb => {
    const done = once(cb)
    const request = requester([baseUrl, observable])
    const subscriber = request({url: '/delay'}).subscribe({
      next: res => done(new Error('response channel should not be called when aborting')),
      error: err => done(new Error(`error channel should not be called when aborting, got:\n\n${err.message}`))
    })

    setTimeout(() => subscriber.unsubscribe(), 15)
    setTimeout(() => done(), 250)
  })

  // @todo test timeout errors
})
