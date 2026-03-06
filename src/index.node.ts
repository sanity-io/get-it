import {createRequest as coreCreateRequest} from './index'
import {nodeFetch} from './node/nodeFetch'
import type {CreateRequestOptions} from './types'

const defaultFetch = nodeFetch()

export function createRequest(options?: CreateRequestOptions) {
  return coreCreateRequest({
    ...options,
    fetch: options?.fetch ?? defaultFetch,
  })
}

// Re-export everything from core
export {createBufferedResponse} from './response'
export {HttpError} from './types'
export type {
  BufferedResponse,
  CreateRequestOptions,
  FetchFunction,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TransformMiddleware,
  WrappingMiddleware,
} from './types'
