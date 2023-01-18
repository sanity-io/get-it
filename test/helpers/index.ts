import {getIt as nodeGetIt} from '../../src/index'
import {getIt as browserGetIt} from '../../src/index.browser'
import * as nodeMiddleware from '../../src/middleware'
import * as browserMiddleware from '../../src/middleware.browser'

export {expectRequest, expectRequestBody, promiseRequest} from './expectRequest'

export const isEdge = typeof globalThis.EdgeRuntime === 'string'
export const isNode = !isEdge && typeof document === 'undefined'
export const getIt = isNode ? nodeGetIt : browserGetIt
export const middleware = isNode ? nodeMiddleware : browserMiddleware
const {base, debug} = middleware

export const hostname = isNode || isEdge ? 'localhost' : window.location.hostname
export const debugRequest = debug({verbose: true})
export const serverUrl = `http://${hostname}:9980`
export const serverUrlHttps = `https://${hostname}:9443`
export const baseUrlPrefix = `${serverUrl}/req-test`
export const baseUrlPrefixHttps = `${serverUrlHttps}/req-test`
export const baseUrl = base(baseUrlPrefix)
export const baseUrlHttps = base(baseUrlPrefixHttps.replace(/^http:/, 'https:'))
