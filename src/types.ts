import type {middlewareReducer} from './util/middlewareReducer'
import type {PubSub} from './util/pubsub'

/** @public */
export interface RequestOptions {
  url: string
  body?: any
  bodySize?: number
  cancelToken?: any
  compress?: boolean
  headers?: any
  maxRedirects?: number
  maxRetries?: number
  method?: string
  proxy?: false | {host: string; port: number; auth?: {username: string; password: string}}
  query?: any
  rawBody?: boolean
  shouldRetry?: any
  stream?: boolean
  timeout?: boolean | number | {connect: number; socket: number}
  tunnel?: boolean
}

/** @public */
export interface ProcessedRequestOptions extends RequestOptions {
  url: string
  timeout: false | {connect: number; socket: number}
  method: string
}

/** @public */
export interface RequestChannels {
  request: PubSub<void>
  response: PubSub<void>
  progress: PubSub<void>
  error: PubSub<ErrorType>
  abort: PubSub<void>
}

/** @public */
export type ProcessOptionsHook = (options: ProcessedRequestOptions) => ProcessedRequestOptions

/** @public */
export type ValidateOptionsHook = (options: ProcessedRequestOptions) => void

/** @public */
export interface MiddlewareHooks {
  processOptions?: ProcessOptionsHook
  validateOptions?: unknown
  interceptRequest?: unknown
  finalizeOptions?: unknown
  onRequest?: unknown
  onResponse?: unknown
  onError?: unknown
  onReturn?: unknown
  onHeaders?: unknown
}

/** @public */
export interface MiddlewareReducer {
  processOptions: ProcessOptionsHook[]
  validateOptions: unknown[]
  interceptRequest: unknown[]
  finalizeOptions: unknown[]
  onRequest: unknown[]
  onResponse: unknown[]
  onError: unknown[]
  onReturn: unknown[]
  onHeaders: unknown[]
}

/** @public */
export type Middleware = (options?: unknown) => Partial<MiddlewareHooks>

/** @public */
export type Middlewares = Middleware[]

/** @public */
export interface Context {
  options: unknown
  channels: RequestChannels
  applyMiddleware: ReturnType<typeof middlewareReducer>
}

/** @public */
export type Requester = {
  use: (middleware: Middleware) => Requester
  clone: () => Requester
  (options: RequestOptions | string): any
}

/** @public */
export interface Response {
  //
}

/** @public */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ErrorType = Error | any // errors can be any

/**
 * request-node in node, browser-request in browsers
 * @public
 */
export type HttpRequest = (
  context: Context,
  callback: (err: ErrorType, res?: Response) => void
) => void

/** @public */
export interface RetryOptions {
  shouldRetry: (err: ErrorType, num: number, options: any) => boolean
  maxRetries?: number
  retryDelay?: () => number
}
