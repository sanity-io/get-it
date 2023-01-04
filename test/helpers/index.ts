import {describe, it} from 'vitest'

import {base, debug} from '../../src/middleware'

export {expectRequest, expectRequestBody, promiseRequest} from './expectRequest'

export const isNode = typeof window === 'undefined'
export const isIE = !isNode && typeof window.EventSource === 'undefined'
export const isIE9 =
  !isNode && window.XMLHttpRequest && !('withCredentials' in new window.XMLHttpRequest())

export const describeNode = isNode ? describe : describe.skip
export const testIE = isIE ? it : it.skip
export const testNonIE = isIE ? it.skip : it
export const testNonIE9 = isIE9 ? it.skip : it
export const testNode = isNode ? it : it.skip
export const hostname = isNode ? 'localhost' : window.location.hostname
export const debugRequest = debug({verbose: true})
export const serverUrl = `http://${hostname}:9980`
export const serverUrlHttps = `https://${hostname}:9443`
export const baseUrlPrefix = `${serverUrl}/req-test`
export const baseUrlPrefixHttps = `${serverUrlHttps}/req-test`
export const baseUrl = base(baseUrlPrefix)
export const baseUrlHttps = base(baseUrlPrefixHttps.replace(/^http:/, 'https:'))
export const bufferFrom = (str) => {
  const nodeVersion = parseInt(process.version.replace('v', ''), 10)
  return nodeVersion >= 6 ? Buffer.from(str, 'utf8') : new Buffer(str, 'utf8')
}
