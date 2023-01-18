import {base, debug} from '../../src/middleware'

export {expectRequest, expectRequestBody, promiseRequest} from './expectRequest'

export const isEdge = typeof globalThis.EdgeRuntime === 'string'
export const isNode = !isEdge && typeof document === 'undefined'

export const hostname = isNode || isEdge ? 'localhost' : window.location.hostname
export const debugRequest = debug({verbose: true})
export const serverUrl = `http://${hostname}:9980`
export const serverUrlHttps = `https://${hostname}:9443`
export const baseUrlPrefix = `${serverUrl}/req-test`
export const baseUrlPrefixHttps = `${serverUrlHttps}/req-test`
export const baseUrl = base(baseUrlPrefix)
export const baseUrlHttps = base(baseUrlPrefixHttps.replace(/^http:/, 'https:'))
