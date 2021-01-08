const requester = require('../src/index')
const {
  testNode,
  expectRequest,
  baseUrl,
  baseUrlPrefix,
  promiseRequest,
  expect,
} = require('./helpers')

describe('redirects', () => {
  it('should handle redirects', () => {
    const request = requester([baseUrl])
    const req = request({url: '/redirect?n=8'})
    return promiseRequest(req).then((res) => {
      expect(res).to.have.property('statusCode', 200)
      expect(res).to.have.property('body', 'Done redirecting')
      expect(res).to.have.property('url', `${baseUrlPrefix}/redirect?n=10`)
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
