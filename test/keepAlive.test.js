const {keepAlive} = require('../src/middleware')
const requester = require('../src/index')
const {testNode, expectRequestBody, baseUrl} = require('./helpers')

describe('keepAlive middleware', () => {
  testNode('should work with redirects (passing `agents`)', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, keepAlive()])
    return Promise.all([
      expectRequestBody(request('/plain-text')).to.eventually.eql(body),
      new Promise((resolve) => setTimeout(resolve, 50)).then(() =>
        expectRequestBody(request('/plain-text')).to.eventually.eql(body)
      ),
    ])
  })

  testNode('should work without redirects (passing `agent`)', () => {
    const body = 'Just some plain text for you to consume'
    const request = requester([baseUrl, keepAlive()])
    const options = {url: '/plain-text', maxRedirects: 0}
    return Promise.all([
      expectRequestBody(request(options)).to.eventually.eql(body),
      new Promise((resolve) => setTimeout(resolve, 50)).then(() =>
        expectRequestBody(request(options)).to.eventually.eql(body)
      ),
    ])
  })
})
