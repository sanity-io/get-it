const requester = require('../src/index')
const {testNode, expectRequest, baseUrl, baseUrlPrefix} = require('./helpers')

describe('redirects', () => {
  it('should handle redirects', () => {
    const request = requester([baseUrl])
    const req = request({url: '/redirect?n=8'})
    return expectRequest(req).to.eventually.containSubset({
      statusCode: 200,
      body: 'Done redirecting',
      url: `${baseUrlPrefix}/redirect?n=10`,
    })
  })

  testNode('should be able to set max redirects (node)', () => {
    const request = requester([baseUrl])
    const req = request({url: '/redirect?n=7', maxRedirects: 2})
    return expectRequest(req).to.eventually.be.rejectedWith(/maximum.*?redirects/i)
  })

  testNode('should be able to be told NOT to follow redirects', () => {
    const request = requester([baseUrl])
    const req = request({url: '/redirect?n=8', maxRedirects: 0})
    return expectRequest(req).to.eventually.containSubset({statusCode: 302})
  })
})
