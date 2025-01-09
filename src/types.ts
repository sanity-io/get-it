import type {IncomingHttpHeaders, IncomingMessage} from 'http'
import type {ProgressStream} from 'progress-stream'
import type {UrlWithStringQuery} from 'url'

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
  retryDelay?: (attemptNumber: number) => number
  method?: string
  proxy?: any
  query?: any
  rawBody?: boolean
  shouldRetry?: any
  stream?: boolean
  timeout?: any
  tunnel?: boolean
  debug?: any
  requestId?: number
  attemptNumber?: number
  withCredentials?: boolean
  /**
   * Enables using the native `fetch` API instead of the default `http` module, and allows setting its options like `cache`
   */
  fetch?: boolean | Omit<RequestInit, 'method'>
  /**
   * Some frameworks have special behavior for `fetch` when an `AbortSignal` is used, and may want to disable it unless userland specifically opts-in.
   */
  useAbortSignal?: boolean
}

/** @public */
export interface Subscriber<Event> {
  (event: Event): void
}
/** @public */
export interface PubSub<Message> {
  publish: (message: Message) => void
  subscribe: (subscriber: Subscriber<Message>) => () => void
}

/** @public */
export interface MiddlewareChannels {
  request: PubSub<HttpContext>
  response: PubSub<unknown>
  progress: PubSub<unknown>
  error: PubSub<unknown>
  abort: PubSub<void>
}

/** @public */
export interface FinalizeNodeOptionsPayload extends UrlWithStringQuery {
  method: RequestOptions['method']
  headers: RequestOptions['headers']
  maxRedirects: RequestOptions['maxRedirects']
  agent?: any
  cert?: any
  key?: any
  ca?: any
}

/** @public */
export interface MiddlewareHooks {
  processOptions: (options: RequestOptions) => RequestOptions
  validateOptions: (options: RequestOptions) => void | undefined
  interceptRequest: (
    prevValue: MiddlewareResponse | undefined,
    event: {adapter: RequestAdapter; context: HttpContext},
  ) => MiddlewareResponse | undefined | void
  finalizeOptions: (
    options: FinalizeNodeOptionsPayload | RequestOptions,
  ) => FinalizeNodeOptionsPayload | RequestOptions
  onRequest: (evt: HookOnRequestEvent) => void
  onResponse: (response: MiddlewareResponse, context: HttpContext) => MiddlewareResponse
  onError: (err: Error | null, context: HttpContext) => any
  onReturn: (channels: MiddlewareChannels, context: HttpContext) => any
  onHeaders: (
    response: IncomingMessage,
    evt: {
      headers: IncomingHttpHeaders
      adapter: RequestAdapter
      context: HttpContext
    },
  ) => ProgressStream
}

/** @public */
export interface HookOnRequestEventBase {
  options: RequestOptions
  context: HttpContext
  request: any
}
/** @public */
export interface HookOnRequestEventNode extends HookOnRequestEventBase {
  adapter: 'node'
  progress: any
}
/** @public */
export interface HookOnRequestEventBrowser extends HookOnRequestEventBase {
  adapter: Omit<RequestAdapter, 'node'>
  progress?: undefined
}
/** @public */
export type HookOnRequestEvent = HookOnRequestEventNode | HookOnRequestEventBrowser

/** @public */
export interface HttpContext {
  options: RequestOptions
  channels: MiddlewareChannels
  applyMiddleware: ApplyMiddleware
}

/** @public */
export type MiddlewareReducer = {
  [T in keyof MiddlewareHooks]: ((
    ...args: Parameters<MiddlewareHooks[T]>
  ) => ReturnType<MiddlewareHooks[T]>)[]
}

/** @public */
export type ApplyMiddleware = <T extends keyof MiddlewareHooks>(
  hook: T,
  value: MiddlewareHooks[T] extends (defaultValue: infer V, ...rest: any[]) => any ? V : never,
  ...args: MiddlewareHooks[T] extends (defaultValue: any, ...rest: infer P) => any ? P : never
) => ReturnType<MiddlewareHooks[T]>

/** @public */
export type DefineApplyMiddleware = (middleware: MiddlewareReducer) => ApplyMiddleware

/** @public */
export type MiddlewareHookName = keyof MiddlewareHooks

/** @public */
export type Middleware = Partial<MiddlewareHooks>

/** @public */
export type Middlewares = Middleware[]

/** @public */
export interface HttpRequestOngoing {
  abort: () => void
}

/** @public */
export interface MiddlewareRequest {} // eslint-disable-line @typescript-eslint/no-empty-object-type

/** @public */
export interface MiddlewareResponse {
  body: any
  url: string
  method: string
  headers: any
  statusCode: number
  statusMessage: string
}

/**
 * request-node in node, browser-request in browsers
 * @public
 */
export type HttpRequest = (
  context: HttpContext,
  callback: (err: Error | null, response?: MiddlewareResponse) => void,
) => HttpRequestOngoing

/** @public */
export interface RetryOptions {
  shouldRetry: (err: any, num: number, options: any) => boolean
  maxRetries?: number
  retryDelay?: (attemptNumber: number) => number
}

/**
 * Reports the environment as either "node" or "browser", depending on what entry point was used to aid bundler debugging.
 * If 'browser' is used, then the globally available `fetch` class is used. While `node` will always use either `node:https` or `node:http` depending on the protocol.
 * @public
 */
export type ExportEnv = 'node' | 'react-server' | 'browser'

/**
 * Reports the request adapter in use. `node` is only available if `ExportEnv` is also `node`.
 * When `ExportEnv` is `browser` then the adapter can be either `xhr` or `fetch`.
 * In the future `fetch` will be available in `node` as well.
 * @public
 */
export type RequestAdapter = 'node' | 'xhr' | 'fetch'

/** @public */
export type Requester = {
  use: (middleware: Middleware) => Requester
  clone: () => Requester
  (options: RequestOptions | string): any
}
