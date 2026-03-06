// ---------------------------------------------------------------------------
// Fetch subset
// ---------------------------------------------------------------------------

/** @public */
export interface FetchInit {
  method?: string
  headers?: HeadersInit
  body?: BodyInit | null
  signal?: AbortSignal
  redirect?: RequestRedirect
}

/** @public */
export interface FetchResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  body: ReadableStream<Uint8Array> | null
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

/** @public */
export type FetchFunction = (input: string, init?: FetchInit) => Promise<FetchResponse>

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

/** @public */
export interface CreateRequestOptions {
  base?: string
  headers?: HeadersInit
  httpErrors?: boolean
  timeout?: number | false
  fetch?: FetchFunction
  middleware?: Array<TransformMiddleware | WrappingMiddleware>
}

/** @public */
export interface RequestOptions {
  url: string
  method?: string
  body?: unknown
  headers?: HeadersInit
  query?: Record<string, string | number | boolean | undefined>
  as?: 'json' | 'text' | 'stream'
  signal?: AbortSignal
  httpErrors?: boolean
  timeout?: number | false
  fetch?: FetchFunction
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/** @public */
export interface BufferedResponse {
  status: number
  statusText: string
  headers: Headers
  body: Uint8Array
  json(): unknown
  text(): string
  bytes(): Uint8Array
}

/** @public */
export interface JsonResponse<T = unknown> {
  status: number
  statusText: string
  headers: Headers
  body: T
}

/** @public */
export interface TextResponse {
  status: number
  statusText: string
  headers: Headers
  body: string
}

/** @public */
export interface StreamResponse {
  status: number
  statusText: string
  headers: Headers
  body: ReadableStream<Uint8Array>
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** @public */
export interface TransformMiddleware {
  beforeRequest?: (options: RequestOptions) => RequestOptions
  afterResponse?: (response: BufferedResponse) => BufferedResponse
}

/** @public */
export type WrappingMiddleware = (
  options: RequestOptions,
  next: (opts: RequestOptions) => Promise<BufferedResponse>,
) => Promise<BufferedResponse>

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

/** @public */
export class HttpError extends Error {
  status: number
  statusText: string
  headers: Headers
  body: unknown
  response: BufferedResponse | JsonResponse | TextResponse

  constructor(opts: {
    status: number
    statusText: string
    headers: Headers
    body: unknown
    response: BufferedResponse | JsonResponse | TextResponse
  }) {
    super(`HTTP ${opts.status} ${opts.statusText}`)
    this.name = 'HttpError'
    this.status = opts.status
    this.statusText = opts.statusText
    this.headers = opts.headers
    this.body = opts.body
    this.response = opts.response
  }
}

// ---------------------------------------------------------------------------
// Request function overloads
// ---------------------------------------------------------------------------

/** @public */
export interface RequestFunction {
  <T = unknown>(options: RequestOptions & {as: 'json'}): Promise<JsonResponse<T>>
  (options: RequestOptions & {as: 'text'}): Promise<TextResponse>
  (options: RequestOptions & {as: 'stream'}): Promise<StreamResponse>
  (options: RequestOptions): Promise<BufferedResponse>
  (url: string): Promise<BufferedResponse>
}
