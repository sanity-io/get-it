const {jsonResponse, headers} = require('../src/middleware')
const requester = require('../src/index')
const {
  expectRequest,
  expectRequestBody,
  baseUrl
} = require('./helpers')

describe('headers', () => {
  it('should be able to set http headers', () => {
    const request = requester([baseUrl, jsonResponse()])
    const req = request({url: '/debug', headers: {'X-My-Awesome-Header': 'forsure'}})

    return expectRequestBody(req).to.eventually.have.property('headers')
      .and.containSubset({'x-my-awesome-header': 'forsure'})
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

  it('should be able to set default headers using headers middleware', () => {
    const defHeaders = headers({'X-Name': 'Something', 'X-Dont-Override': 'You'})
    const request = requester([baseUrl, jsonResponse(), defHeaders])
    const req = request({url: '/debug', headers: {'X-Dont-Override': 'Me'}})
    return expectRequestBody(req).to.eventually.have.property('headers')
      .and.containSubset({'x-name': 'Something', 'x-dont-override': 'Me'})
  })

  it('should be able to set overriding headers using headers middleware', () => {
    const defHeaders = headers({'X-Name': 'Something', 'X-Dont-Override': 'You'}, {override: true})
    const request = requester([baseUrl, jsonResponse(), defHeaders])
    const req = request({url: '/debug', headers: {'X-Dont-Override': 'Me'}})
    return expectRequestBody(req).to.eventually.have.property('headers')
      .and.containSubset({'x-name': 'Something', 'x-dont-override': 'You'})
  })
})
