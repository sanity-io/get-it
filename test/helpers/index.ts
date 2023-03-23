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
// happy-dom isn't implementing xhr.response: https://github.com/capricorn86/happy-dom/blob/13bcfe77ae9a202a93ce8fddcf4a7c1b43ecde16/packages/happy-dom/src/xml-http-request/XMLHttpRequest.ts#L149-L234
export const isHappyDomBug =
  typeof XMLHttpRequest !== 'undefined' && !XMLHttpRequest.prototype.response
