const once = require('lodash.once')
const {injectResponse} = require('../src/middleware')
const requester = require('../src/index')
const {
  baseUrl,
  expect,
  expectRequest,
  expectRequestBody,
} = require('./helpers')

describe('inject response', () => {
  it('should throw if not provided with an `inject` function', () => {
    expect(injectResponse).to.throw(/inject/)
  })

  it('should be able to inject before dns resolution', () => {
    const inject = () => ({body: 'foo'})
    const request = requester([injectResponse({inject})])
    const req = request({url: 'http://some-unknown-host'})

    return expectRequestBody(req).to.eventually.equal('foo')
  })

  it('should be able to specify headers', () => {
    const headers = {'x-my-mock': 'is-mocked'}
    const inject = () => ({headers})
    const request = requester([baseUrl, injectResponse({inject})])
    const req = request({url: '/headers'})

    return expectRequest(req).to.eventually.have.property('headers')
      .and.containSubset({'x-my-mock': 'is-mocked'})
  })

  it('should be able to use real request on a per-request basis', () => {
    const mock = {body: 'Just some mocked text'}
    const inject = evt => evt.context.options.url.indexOf('/mocked') !== -1 && mock
    const request = requester([baseUrl, injectResponse({inject})])
    const normalReq = request({url: '/plain-text'})
    const mockedReq = request({url: '/mocked'})

    return Promise.all([
      expectRequestBody(normalReq).to.eventually.contain('Just some plain text'),
      expectRequestBody(mockedReq).to.eventually.contain('Just some mocked text'),
    ])
  })

  it('should be able to immediately cancel request', cb => {
    const done = once(cb)
    const inject = () => ({body: 'foo'})
    const request = requester([injectResponse({inject})])
    const req = request({url: 'http://blah-blah'})

    req.error.subscribe(err => done(new Error(`error channel should not be called when aborting, got:\n\n${err.message}`)))
    req.response.subscribe(() => done(new Error('response channel should not be called when aborting')))

    req.abort.publish()

    setTimeout(() => done(), 250)
  })
})
