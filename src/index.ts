import {createRequester} from './createRequester'
import {httpRequester} from './request/node-request'
import type {ExportEnv, HttpRequest, Middlewares, Requester} from './types'

export type * from './types'

/** @public */
export const getIt = (
  initMiddleware: Middlewares = [],
  httpRequest: HttpRequest = httpRequester
): Requester => createRequester(initMiddleware, httpRequest)

/** @public */
export const environment: ExportEnv = 'node'

/** @public */
export {adapter} from './request/node-request'
