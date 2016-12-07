const {jsonResponse} = require('../src/middleware')
const requester = require('../src/index')
const {
  expectRequest,
  expectRequestBody,
  baseUrl
} = require('./helpers')

describe('headers', () => {
  it('should be able to set http headers', () => {
    const request = requester([baseUrl, jsonResponse])
    const req = request({url: '/debug', headers: {'X-My-Awesome-Header': 'absolutely'}})
    return expectRequestBody(req).to.eventually.have.property('headers')
      .and.containSubset({'x-my-awesome-header': 'absolutely'})
  })

  it('should return the response headers', () => {
    const request = requester([baseUrl])
    const req = request({url: '/headers'})
    return expectRequest(req).to.eventually.have.property('headers')
      .and.containSubset({
        'x-custom-header': 'supercustom',
        'content-type': 'text/markdown'
      })
  })
})
