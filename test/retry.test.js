const requester = require('../src/index')
const {retry, httpErrors} = require('../src/middleware')
const {
  testNode,
  debugRequest,
  expectRequest,
  baseUrl,
  isIE9,
  isNode
} = require('./helpers')


describe('retry middleware', () => {
  const retry5xx = err => err.response.statusCode >= 500

  it('should handle retries when retry middleware is used', () => {
    const request = requester([baseUrl, debugRequest, retry()])
    const browserAt = isIE9 ? 4 : 7
    const successAt = isNode ? 4 : browserAt // Browsers have a weird thing where they might auto-retry on network errors
    const req = request({url: `/fail?uuid=${Math.random()}&n=${successAt}`})

    return expectRequest(req).to.eventually.containSubset({
      statusCode: 200,
      body: 'Success after failure'
    })
  })

  // Browsers are not playing nice in regards to network errors and retries
  it('should be able to set max retries', function () {
    this.timeout(250)
    const request = requester([baseUrl, httpErrors, retry({maxRetries: 1, shouldRetry: retry5xx})])
    const req = request({url: '/status?code=500'})
    return expectRequest(req).to.eventually.be.rejectedWith(/HTTP 500/i)
  })

  it('should be able to set a custom function on whether or not we should retry', () => {
    const shouldRetry = (error, retryCount) => retryCount !== 1
    const request = requester([baseUrl, debugRequest, httpErrors, retry({shouldRetry})])
    const req = request({url: '/status?code=503'})
    return expectRequest(req).to.eventually.be.rejectedWith(/HTTP 503/)
  })

  // @todo Browsers are really flaky with retries, revisit later
  testNode('should handle retries with a delay function ', () => {
    const retryDelay = () => 375
    const request = requester([baseUrl, retry({retryDelay})])

    const startTime = Date.now()
    const req = request({url: `/fail?uuid=${Math.random()}&n=4`})
    return expectRequest(req).to.eventually.satisfy(() => {
      const timeUsed = Date.now() - startTime
      return timeUsed > 1000 && timeUsed < 1750
    }, 'respects the retry delay (roughly)')
  })
})
