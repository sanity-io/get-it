const {observable} = require('../src/middleware')
const requester = require('../src/index')
const {expect, baseUrl} = require('./helpers')

describe.skip('observable middleware', () => {
  it('should turn the return value into an observable', () => {
    const request = requester([baseUrl, observable])
    const req = request({url: '/plain-text'})
    return expect(req).to.eventually.containSubset({
      body: 'Just some plain text for you to consume',
      method: 'GET',
      statusCode: 200
    })
  })

  it('should reject errors', () => {
    const request = requester([baseUrl, observable])
    const req = request({url: '/permafail'})
    return expect(req).to.eventually.be.rejectedWith(/(socket|network)/i)
  })

  // @todo test timeout errors
  // @todo cancelation
})
