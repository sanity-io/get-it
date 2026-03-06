import {base, debug} from 'get-it/middleware'

export {expectRequest, expectRequestBody, promiseRequest} from './expectRequest'

export const hostname =
  (typeof window !== 'undefined' && (window as any).location?.hostname) || 'localhost'
export const debugRequest = debug({verbose: true})
export const serverUrl = `http://${hostname}:9980`
export const serverUrlHttps = `https://${hostname}:9443`
export const baseUrlPrefix = `${serverUrl}/req-test`
export const baseUrlPrefixHttps = `${serverUrlHttps}/req-test`
export const baseUrl = base(baseUrlPrefix)
export const baseUrlHttps = base(baseUrlPrefixHttps.replace(/^http:/, 'https:'))
