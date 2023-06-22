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
  proxy?: any
  query?: any
  rawBody?: boolean
  shouldRetry?: any
  stream?: boolean
  timeout?: any
  tunnel?: boolean
  debug?: any
  requestId?: number
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
  request: PubSub<any>
  response: PubSub<any>
  progress: PubSub<any>
  error: PubSub<unknown>
  abort: PubSub<void>
}

/** @public */
export interface MiddlewareHooks {
  processOptions: (options: RequestOptions) => RequestOptions
  validateOptions: (options: RequestOptions) => void | undefined
  interceptRequest: (
    prevValue: any,
    event: {adapter: RequestAdapter; context: {options: RequestOptions; [key: string]: any}}
  ) => any
  finalizeOptions: (options: RequestOptions) => RequestOptions
  onRequest: (evt: {adapter: RequestAdapter; [key: string]: any}) => any
  onResponse: (response: any, context: any) => any
  onError: (err: any, context: any) => any
  onReturn: (channels: MiddlewareChannels, context: any) => any
  onHeaders: (response: any, evt: any) => any
}

/** @public */
export type MiddlewareReducer = {
  [P in keyof MiddlewareHooks]: MiddlewareHooks[P][]
}

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

/**
 * request-node in node, browser-request in browsers
 * @public
 */
export type HttpRequest = (
  context: any,
  callback: (err: Error | null, response?: any) => void
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
export type ExportEnv = 'node' | 'browser'

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
