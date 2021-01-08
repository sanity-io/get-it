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

      // PhantomJS/IE/older browsers doesn't give the resolved URL,
      // so accept n=8 even though it's technically incorrect.
      // The body property is good enough to check that it _actually_ redirected
      expect(
        res.url === `${baseUrlPrefix}/redirect?n=8` || res.url === `${baseUrlPrefix}/redirect?n=10`
      ).to.equal(true)
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
