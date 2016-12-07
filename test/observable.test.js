const {observable} = require('../src/middleware')
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
    const request = requester([baseUrl, observable])
    request({url: '/permafail'}).subscribe({
      next: () => done(new Error('next() called when error() should have been')),
      error: err => {
        expect(err.message).to.match(/(socket|network)/i)
        done()
      }
    })
  })

  // @todo test timeout errors
  // @todo cancelation
})
