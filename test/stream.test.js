const getUri = require('./helpers/getUri')
const toStream = require('into-stream')
const requester = require('../src/index')
const {
  expectRequest,
  expectRequestBody,
  describeNode,
  debugRequest,
  baseUrlPrefix,
  baseUrl
} = require('./helpers')

describeNode('streams', function () {
  this.timeout(15000)

  it('should be able to send a stream to a remote endpoint', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/echo', body: toStream(body)})
    return expectRequestBody(req).to.eventually.equal(body)
  })

  it('should be able to pipe one request stream into the other', () =>
    getUri(`${baseUrlPrefix}/plain-text`).then(stream => {
      const expected = 'Just some plain text for you to consume'
      const request = requester([baseUrl, debugRequest])
      const req = request({url: '/echo', body: stream})
      return expectRequestBody(req).to.eventually.equal(expected)
    })
  )

  it('does not retry failed requests when using streams', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, debugRequest])
    const req = request({url: '/fail?n=3', body: toStream(body)})
    return expectRequest(req).to.eventually.be.rejectedWith(Error)
  })
})
