const global = require('global')
if (typeof global.Promise === 'undefined') {
  require('es6-promise/auto')
}

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const chaiSubset = require('chai-subset')
const {base, debug} = require('../../src/middleware')
const {expectRequest, expectRequestBody} = require('./expectRequest')
const expect = chai.expect

chai.use(chaiSubset)
chai.use(chaiAsPromised)

const isNode = typeof window === 'undefined'
const isIE = !isNode && typeof window.EventSource === 'undefined'
const isIE9 = (!isNode && window.XMLHttpRequest
  && !('withCredentials' in (new window.XMLHttpRequest())))

const testIE = isIE ? it : it.skip
const testNonIE = isIE ? it.skip : it
const testNonIE9 = isIE9 ? it.skip : it
const testNode = isNode ? it : it.skip
const hostname = isNode ? 'localhost' : window.location.hostname
const debugRequest = debug({verbose: true})
const serverUrl = `http://${hostname}:9876`
const baseUrlPrefix = `${serverUrl}/req-test`
const baseUrl = base(baseUrlPrefix)
const bufferFrom = str => {
  const nodeVersion = parseInt(process.version.replace('v', ''), 10)
  return nodeVersion >= 6
    ? Buffer.from(str, 'utf8')
    : new Buffer(str, 'utf8')
}

module.exports = {
  expectRequest,
  expectRequestBody,
  expect,
  testNonIE9,
  testNonIE,
  testIE,
  testNode,
  debugRequest,
  serverUrl,
  baseUrlPrefix,
  baseUrl,
  isIE9,
  isNode,
  bufferFrom
}
