// ---------------------------------------------------------------------------
// Fetch subset
// ---------------------------------------------------------------------------

export interface FetchInit {
  method?: string
  headers?: Record<string, string>
  body?: BodyInit | null
  signal?: AbortSignal
  redirect?: RequestRedirect
}

export interface FetchResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Headers
  body: ReadableStream<Uint8Array> | null
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

export type FetchFunction = (input: string, init?: FetchInit) => Promise<FetchResponse>

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

export interface CreateRequestOptions {
  base?: string
  headers?: Record<string, string>
  httpErrors?: boolean
  timeout?: number | false
  fetch?: FetchFunction
  middleware?: Array<TransformMiddleware | WrappingMiddleware>
}

export interface RequestOptions {
  url: string
  method?: string
  body?: unknown
  headers?: Record<string, string>
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

export interface BufferedResponse {
  status: number
  statusText: string
  headers: Headers
  body: Uint8Array
  json(): unknown
  text(): string
  bytes(): Uint8Array
}

export interface JsonResponse<T = unknown> {
  status: number
  statusText: string
  headers: Headers
  body: T
}

export interface TextResponse {
  status: number
  statusText: string
  headers: Headers
  body: string
}

export interface StreamResponse {
  status: number
  statusText: string
  headers: Headers
  body: ReadableStream<Uint8Array>
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export interface TransformMiddleware {
  beforeRequest?: (options: RequestOptions) => RequestOptions
  afterResponse?: (response: BufferedResponse) => BufferedResponse
}

export type WrappingMiddleware = (
  options: RequestOptions,
  next: (options: RequestOptions) => Promise<BufferedResponse>,
) => Promise<BufferedResponse>

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

export class HttpError extends Error {
  status: number
  statusText: string
  headers: Headers
  body: unknown
  response: BufferedResponse

  constructor(opts: {
    status: number
    statusText: string
    headers: Headers
    body: unknown
    response: BufferedResponse
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

interface RequestFunctionBase {
  <T = unknown>(options: RequestOptions & { as: 'json' }): Promise<JsonResponse<T>>
  (options: RequestOptions & { as: 'text' }): Promise<TextResponse>
  (options: RequestOptions & { as: 'stream' }): Promise<StreamResponse>
  (options: RequestOptions): Promise<BufferedResponse>
  (url: string): Promise<BufferedResponse>
}

export type RequestFunction = RequestFunctionBase
