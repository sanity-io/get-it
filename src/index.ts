import {createRequester} from './createRequester'
import {httpRequester} from './request/node-request'
import type {HttpRequest, Middlewares, Requester} from './types'

export * from './types'

/** @public */
export const getIt = (
  initMiddleware: Middlewares = [],
  httpRequest: HttpRequest = httpRequester
): Requester => createRequester(initMiddleware, httpRequest)
