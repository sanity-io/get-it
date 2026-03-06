import type {CreateRequestOptions} from 'get-it'
import {createRequest as coreCreateRequest} from 'get-it'
import {nodeFetch} from 'get-it/node'

const defaultFetch = nodeFetch()

/** @public */
export function createRequest(options?: CreateRequestOptions) {
  return coreCreateRequest({
    ...options,
    fetch: options?.fetch ?? defaultFetch,
  })
}

// Re-export everything from core
export type {
  BufferedResponse,
  FetchFunction,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TransformMiddleware,
  WrappingMiddleware,
} from 'get-it'
export {createBufferedResponse, HttpError} from 'get-it'
