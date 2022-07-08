require('./init.test')

const util = require('util')
const requester = require('../src/index')
const {debug, jsonRequest, jsonResponse} = require('../src/middleware')
const {baseUrl, expect} = require('./helpers')

describe('debug middleware', () => {
  const log = str => expect(str).to.be.a('string')

  it('should be able to use default options', () => {
    expect(() => debug()).to.not.throw()
  })

  it('should be able to pass custom logger', done => {
    const logger = debug({log})
    const request = requester([baseUrl, logger])
    request({url: '/plain-text'}).response.subscribe(() => done())
  })

  it('should be able to pass custom logger (verbose mode)', done => {
    const logger = debug({log, verbose: true})
    const request = requester([baseUrl, logger])
    request({url: '/plain-text'}).response.subscribe(() => done())
  })

  it('should be able to pass custom logger (verbose mode + json request body)', done => {
    const logger = debug({log, verbose: true})
    const request = requester([baseUrl, jsonRequest(), jsonResponse(), logger])
    request({url: '/json-echo', method: 'PUT', body: {foo: 'bar'}}).response.subscribe(() => done())
  })

  it('should be able to pass custom logger (verbose mode + text request body)', done => {
    const logger = debug({log, verbose: true})
    const request = requester([baseUrl, logger])
    request({url: '/echo', body: 'Just some text'}).response.subscribe(() => done())
  })

  it('should be able to pass custom logger (invalid JSON in response)', done => {
    const logger = debug({log, verbose: true})
    const request = requester([baseUrl, logger])
    request({url: '/invalid-json'}).response.subscribe(() => done())
  })

  it('should redact sensitive headers in verbose mode', done => {
    const lines = []
    const logIt = (line, ...args) => lines.push(util.format(line, ...args))
    const logger = debug({log: logIt, verbose: true})
    const request = requester([baseUrl, logger])
    request({
      url: '/echo',
      headers: {CoOkIe: 'yes cookie', authorization: 'bearer auth'},
      body: 'Just some text'
    }).response.subscribe(() => {
      expect(lines.join('\n')).not.to.contain('yes cookie')
      expect(lines.join('\n')).to.contain('<redacted>')
      done()
    })
  })
})
