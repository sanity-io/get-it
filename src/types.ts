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
}

/** @public */
export type Middleware = any

/** @public */
export type Middlewares = Middleware[]

/** @public */
export type Requester = {
  use: (middleware: Middleware) => Requester
  clone: () => Requester
  (options: RequestOptions | string): any
}

/**
 * request-node in node, browser-request in browsers
 * @public
 */
export type HttpRequest = any

/** @public */
export interface RetryOptions {
  shouldRetry: (err: any, num: number, options: any) => boolean
  maxRetries?: number
  retryDelay?: () => number
}
