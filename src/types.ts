// ---------------------------------------------------------------------------
// Web platform type aliases — inlined so we don't depend on the DOM lib
// ---------------------------------------------------------------------------

/**
 * Valid body types for fetch requests.
 *
 * @public
 */
export type FetchBody = string | ArrayBuffer | Blob | FormData | URLSearchParams | ReadableStream

/**
 * Accepted header formats — tuple pairs, a plain record, or a `Headers` instance.
 *
 * @public
 */
export type FetchHeaders = [string, string][] | Record<string, string> | Headers

// ---------------------------------------------------------------------------
// Fetch subset
// ---------------------------------------------------------------------------

/**
 * Init options passed to a {@link FetchFunction}.
 *
 * This is a minimal subset of the standard `RequestInit` so the library
 * doesn't depend on the full DOM lib.
 *
 * @public
 */
export interface FetchInit {
  /** HTTP method (GET, POST, PUT, etc.). */
  method?: string
  /** Request headers. */
  headers?: FetchHeaders
  /** Request body. */
  body?: FetchBody | null
  /** Abort signal for cancellation. */
  signal?: AbortSignal
  /** Redirect handling strategy. */
  redirect?: 'error' | 'follow' | 'manual'
  /** Credentials mode (browser-only — some runtimes crash if set). */
  credentials?: 'include' | 'omit' | 'same-origin'
}

/**
 * Response object returned by a {@link FetchFunction}.
 *
 * A minimal subset of the standard `Response` — just the properties
 * get-it actually reads.
 *
 * @public
 */
export interface FetchResponse {
  /** Whether the response status is in the 200–299 range. */
  ok: boolean
  /** HTTP status code. */
  status: number
  /** HTTP status text (e.g. "OK", "Not Found"). */
  statusText: string
  /** Response headers. */
  headers: Headers
  /** Readable stream of the response body, or `null` if empty. */
  body: ReadableStream<Uint8Array> | null
  /** Reads the entire body as a string. */
  text(): Promise<string>
  /** Reads the entire body as an ArrayBuffer. */
  arrayBuffer(): Promise<ArrayBuffer>
}

/**
 * A function that performs an HTTP fetch. Must conform to the standard
 * `fetch()` signature but only needs to return a `FetchResponse`.
 *
 * @param input - The URL to fetch.
 * @param init - Optional request init options.
 * @returns A promise resolving to the response.
 *
 * @public
 */
export type FetchFunction = (input: string, init?: FetchInit) => Promise<FetchResponse>

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

/**
 * Configuration options for {@link createRequester}.
 *
 * @public
 */
export interface RequesterOptions {
  /** Base URL prepended to relative request URLs. */
  base?: string
  /** Default headers sent with every request. Per-request headers take precedence. */
  headers?: FetchHeaders
  /** When `true` (default), throws {@link HttpError} for 4xx/5xx responses. */
  httpErrors?: boolean
  /** Default request timeout in milliseconds. Set to `false` to disable. Defaults to 120 000 ms. */
  timeout?: number | false
  /** Custom fetch implementation. In Node.js, defaults to an undici-backed fetch. */
  fetch?: FetchFunction
  /** Credentials mode forwarded to fetch (browser-only). */
  credentials?: 'include' | 'omit' | 'same-origin'
  /** Middleware stack applied to every request. */
  middleware?: Array<TransformMiddleware | WrappingMiddleware>
}

/**
 * Options for a single HTTP request.
 *
 * @public
 */
export interface RequestOptions {
  /** The URL to request. Relative URLs are resolved against `RequesterOptions.base`. */
  url: string
  /** HTTP method. Defaults to `GET`, or `POST` when a body is present. */
  method?: string
  /** Request body. Plain objects and arrays are JSON-serialized automatically. */
  body?: unknown
  /** Request headers. Merged with instance-level headers (per-request wins). */
  headers?: FetchHeaders
  /** Query parameters appended to the URL. */
  query?: Record<string, string | number | boolean | undefined> | URLSearchParams
  /** Response format — determines the return type. Defaults to buffered. */
  as?: 'json' | 'text' | 'stream'
  /** Abort signal for cancellation. Combined with the timeout signal via `AbortSignal.any`. */
  signal?: AbortSignal
  /** Override the instance-level `httpErrors` setting for this request. */
  httpErrors?: boolean
  /** Override the instance-level `timeout` for this request. */
  timeout?: number | false
  /** Override the instance-level `fetch` for this request. */
  fetch?: FetchFunction
  /** Credentials mode forwarded to fetch (browser-only). */
  credentials?: 'include' | 'omit' | 'same-origin'
  /** Redirect handling strategy. */
  redirect?: 'error' | 'follow' | 'manual'
  /** Arbitrary metadata — not used by get-it, but available to middleware. */
  meta?: {
    /** Custom request identifier used by the `debug` middleware in log output. */
    requestId?: string | number
  } & Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/**
 * Response with a fully buffered body and convenience accessors for
 * decoding the bytes as text, JSON, or raw bytes.
 *
 * Returned by default when no `as` option is specified.
 *
 * @public
 */
export interface BufferedResponse {
  /** HTTP status code. */
  status: number
  /** HTTP status text. */
  statusText: string
  /** Response headers. */
  headers: Headers
  /** Raw response body bytes. */
  body: Uint8Array
  /** Parses the body as JSON. The result is cached after the first call. */
  json(): unknown
  /** Decodes the body as UTF-8 text. The result is cached after the first call. */
  text(): string
  /** Returns the raw body bytes (same as `body`). */
  bytes(): Uint8Array
}

/**
 * Response with a parsed JSON body.
 *
 * Returned when `as: 'json'` is specified.
 *
 * @typeParam T - The expected shape of the JSON body.
 *
 * @public
 */
export interface JsonResponse<T = unknown> {
  /** HTTP status code. */
  status: number
  /** HTTP status text. */
  statusText: string
  /** Response headers. */
  headers: Headers
  /** Parsed JSON body. */
  body: T
}

/**
 * Response with a text body.
 *
 * Returned when `as: 'text'` is specified.
 *
 * @public
 */
export interface TextResponse {
  /** HTTP status code. */
  status: number
  /** HTTP status text. */
  statusText: string
  /** Response headers. */
  headers: Headers
  /** Response body decoded as a string. */
  body: string
}

/**
 * Response with a readable stream body for processing data incrementally.
 *
 * Returned when `as: 'stream'` is specified.
 *
 * @public
 */
export interface StreamResponse {
  /** HTTP status code. */
  status: number
  /** HTTP status text. */
  statusText: string
  /** Response headers. */
  headers: Headers
  /** Readable stream of the response body. */
  body: ReadableStream<Uint8Array>
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Middleware that can transform request options before the fetch and/or
 * transform the buffered response afterward. Both hooks are optional.
 *
 * @public
 */
export interface TransformMiddleware {
  /** Called before each request. Return modified options. */
  beforeRequest?: (options: RequestOptions) => RequestOptions
  /** Called after each response is buffered. Return modified response. */
  afterResponse?: (response: BufferedResponse) => BufferedResponse
}

/**
 * Middleware that wraps the entire fetch chain. Receives the request
 * options and a `next` function to call the next layer. Can modify
 * options, intercept errors, retry, add timing, etc.
 *
 * @param options - The request options.
 * @param next - Calls the next middleware (or the core fetch if last).
 * @returns The buffered response.
 *
 * @public
 */
export type WrappingMiddleware = (
  options: RequestOptions,
  next: (opts: RequestOptions) => Promise<BufferedResponse>,
) => Promise<BufferedResponse>

// ---------------------------------------------------------------------------
// Request function overloads
// ---------------------------------------------------------------------------

/**
 * The overloaded function returned by `createRequester`. The return type
 * is determined by the `as` option:
 *
 * - `as: 'json'` → {@link JsonResponse}
 * - `as: 'text'` → {@link TextResponse}
 * - `as: 'stream'` → {@link StreamResponse}
 * - _(default)_ → {@link BufferedResponse}
 *
 * Can also be called with a plain URL string for simple GET requests.
 *
 * @public
 */
export interface RequestFunction {
  <T = unknown>(options: RequestOptions & {as: 'json'}): Promise<JsonResponse<T>>
  (options: RequestOptions & {as: 'text'}): Promise<TextResponse>
  (options: RequestOptions & {as: 'stream'}): Promise<StreamResponse>
  (options: RequestOptions): Promise<BufferedResponse>
  (url: string): Promise<BufferedResponse>
}
