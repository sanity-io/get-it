import {HttpError} from './errors'
import {createBufferedResponse} from './response'
import type {
  BufferedResponse,
  CreateRequestOptions,
  FetchBody,
  FetchFunction,
  FetchHeaders,
  FetchInit,
  FetchResponse,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TransformMiddleware,
  WrappingMiddleware,
} from './types'

/** @public */
export function createRequest(options?: CreateRequestOptions): RequestFunction {
  const instanceFetch = options?.fetch
  const instanceHeaders = options?.headers
  const instanceBase = options?.base
  const instanceHttpErrors = options?.httpErrors
  const instanceTimeout = options?.timeout
  const instanceCredentials = options?.credentials

  // Separate middleware into transforms and wrappers by shape
  const middleware = options?.middleware ?? []
  const transforms: TransformMiddleware[] = []
  const wrappers: WrappingMiddleware[] = []
  for (const mw of middleware) {
    if (typeof mw === 'object') {
      transforms.push(mw)
    } else {
      wrappers.push(mw)
    }
  }

  /**
   * Core fetch + buffer function. This is the innermost layer
   * that wrapping middlewares eventually call.
   */
  async function coreFetchBuffered(opts: RequestOptions): Promise<BufferedResponse> {
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch
    const {url, init} = buildFetchArgs(opts, instanceTimeout, instanceCredentials)
    const response = await fetchFn(url, init)
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true
    return bufferAndCheck(response, httpErrors, url, init.method ?? 'GET')
  }

  // Compose wrapping middlewares around the core fetch
  const fetchChain = composeFetchChain(coreFetchBuffered, wrappers)

  async function requestJson(opts: RequestOptions): Promise<JsonResponse> {
    const transformedOpts = runBeforeRequest(opts, transforms)
    const buffered = runAfterResponse(await fetchChain(transformedOpts), transforms)
    try {
      return responseOf(buffered, JSON.parse(buffered.text()) as unknown)
    } catch (cause: unknown) {
      throw new TypeError(
        `Failed to parse JSON response from ${opts.url}: ${cause instanceof Error ? cause.message : cause}`,
        {cause},
      )
    }
  }

  async function requestText(opts: RequestOptions): Promise<TextResponse> {
    const transformedOpts = runBeforeRequest(opts, transforms)
    const buffered = runAfterResponse(await fetchChain(transformedOpts), transforms)
    return responseOf(buffered, buffered.text())
  }

  async function requestStream(opts: RequestOptions): Promise<StreamResponse> {
    // Stream mode: beforeRequest transforms + wrapping middleware apply.
    // afterResponse transforms do NOT apply (there is no BufferedResponse to transform).
    const transformedOpts = runBeforeRequest(opts, transforms)

    // Capture the raw fetch response so we can extract the stream after
    // the wrapping middleware chain completes.
    let capturedResponse: FetchResponse | undefined

    async function coreStreamFetch(reqOpts: RequestOptions): Promise<BufferedResponse> {
      const fetchFn: FetchFunction = reqOpts.fetch ?? instanceFetch ?? globalThis.fetch
      const {url, init} = buildFetchArgs(reqOpts, instanceTimeout, instanceCredentials)
      const response = await fetchFn(url, init)
      const httpErrors = reqOpts.httpErrors ?? instanceHttpErrors ?? true

      if (httpErrors && response.status >= 400) {
        return bufferAndCheck(response, httpErrors, url, init.method ?? 'GET')
      }

      capturedResponse = response
      return createBufferedResponse(
        response.status,
        response.statusText,
        response.headers,
        new Uint8Array(0),
      )
    }

    const streamChain = composeFetchChain(coreStreamFetch, wrappers)
    await streamChain(transformedOpts)

    if (!capturedResponse) {
      throw new Error('Stream response was not captured')
    }

    const streamBody =
      capturedResponse.body ??
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      })

    return responseOf(capturedResponse, streamBody)
  }

  // Overloaded request function — each overload dispatches to the
  // appropriately-typed helper, so no type assertions are needed.
  function request<T = unknown>(opts: RequestOptions & {as: 'json'}): Promise<JsonResponse<T>>
  function request(opts: RequestOptions & {as: 'text'}): Promise<TextResponse>
  function request(opts: RequestOptions & {as: 'stream'}): Promise<StreamResponse>
  function request(opts: RequestOptions): Promise<BufferedResponse>
  function request(url: string): Promise<BufferedResponse>
  async function request(
    input: string | RequestOptions,
  ): Promise<BufferedResponse | JsonResponse | TextResponse | StreamResponse> {
    const raw: RequestOptions = typeof input === 'string' ? {url: input} : input

    // Resolve instance-level config into the options so middleware sees the full picture
    let url = raw.url
    if (instanceBase && !/^https?:\/\//.test(url)) {
      url = instanceBase.replace(/\/$/, '') + '/' + url.replace(/^\//, '')
    }
    const opts: RequestOptions = {
      ...raw,
      url,
      headers: mergeHeaders(instanceHeaders, raw.headers),
    }

    switch (opts.as) {
      case 'json':
        return await requestJson(opts)
      case 'text':
        return await requestText(opts)
      case 'stream':
        return await requestStream(opts)
      default: {
        const transformedOpts = runBeforeRequest(opts, transforms)
        const buffered = runAfterResponse(await fetchChain(transformedOpts), transforms)
        return buffered
      }
    }
  }

  return request
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/**
 * Type guard for values that are valid fetch body types.
 * Needed because TS 5.9+ narrows `instanceof Uint8Array` to
 * `Uint8Array<ArrayBufferLike>` which isn't assignable to `FetchBody`.
 */
function isBinaryBody(value: unknown): value is FetchBody {
  return (
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    value instanceof ReadableStream ||
    ArrayBuffer.isView(value) ||
    value instanceof FormData ||
    value instanceof URLSearchParams
  )
}

/**
 * Sanitize a FetchHeaders value by stripping entries with undefined values.
 * Plain Records may contain undefined if callers bypass TypeScript checks;
 * `new Headers()` would stringify them to the literal string "undefined".
 */
function sanitizeHeaders(input: FetchHeaders): FetchHeaders {
  if (input instanceof Headers || Array.isArray(input)) return input
  const clean: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) clean[key] = value
  }
  return clean
}

/**
 * Merge two FetchHeaders values into a single Headers instance.
 * The second argument wins on conflicts.
 */
function mergeHeaders(base: FetchHeaders | undefined, override: FetchHeaders | undefined): Headers {
  const headers = new Headers(base ? sanitizeHeaders(base) : undefined)
  if (override) {
    new Headers(sanitizeHeaders(override)).forEach((value, key) => {
      headers.set(key, value)
    })
  }
  return headers
}

/**
 * Build the URL, headers, and fetch init from request options.
 * Expects headers to already be merged (via mergeHeaders in request()).
 */
function buildFetchArgs(
  opts: RequestOptions,
  instanceTimeout: number | false | undefined,
  instanceCredentials: 'include' | 'omit' | 'same-origin' | undefined,
): {url: string; init: FetchInit} {
  let url = opts.url

  // Query string — merge query params into URL
  if (opts.query) {
    const urlObj = new URL(url)
    const entries =
      opts.query instanceof URLSearchParams ? opts.query.entries() : Object.entries(opts.query)
    for (const [key, value] of entries) {
      if (value === undefined) continue
      urlObj.searchParams.append(key, `${value}`)
    }
    url = urlObj.toString()
  }

  // Headers — opts.headers is already a merged Headers instance
  const headers = new Headers(opts.headers)

  // Build fetch init
  const init: FetchInit = {}
  if (opts.method) init.method = opts.method

  // Implicit POST — default to POST when a body is present and no method is set
  if (!opts.method && opts.body !== undefined && opts.body !== null) {
    init.method = 'POST'
  }

  // JSON request body — auto-serialize plain objects and arrays
  if (opts.body !== undefined && opts.body !== null) {
    if (typeof opts.body === 'string') {
      init.body = opts.body
    } else if (isPlainObject(opts.body) || Array.isArray(opts.body)) {
      init.body = JSON.stringify(opts.body)
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }
    } else if (isBinaryBody(opts.body)) {
      init.body = opts.body
    } else {
      throw new TypeError(`Unsupported body type: ${typeof opts.body}`)
    }
  }

  init.headers = headers

  // Timeout — resolve timeout value (per-request wins over instance, default 120s)
  const timeoutValue = opts.timeout !== undefined ? opts.timeout : (instanceTimeout ?? 120_000)

  // Signal — build the final abort signal
  let signal: AbortSignal | undefined = opts.signal
  if (timeoutValue) {
    const timeoutSignal = AbortSignal.timeout(timeoutValue)
    if (signal) {
      signal = AbortSignal.any([signal, timeoutSignal])
    } else {
      signal = timeoutSignal
    }
  }
  if (signal) init.signal = signal

  // Only set credentials in browser-like environments — some runtimes
  // (e.g. Cloudflare Workers) crash if credentials is set on fetch init.
  const credentials = opts.credentials ?? instanceCredentials
  if (credentials && 'window' in globalThis) init.credentials = credentials

  if (opts.redirect) init.redirect = opts.redirect

  return {url, init}
}

/**
 * Buffer the response body and create a BufferedResponse.
 * Optionally throws HttpError for error status codes.
 */
async function bufferAndCheck(
  response: {
    status: number
    statusText: string
    headers: Headers
    arrayBuffer(): Promise<ArrayBuffer>
  },
  httpErrors: boolean,
  requestUrl: string,
  requestMethod: string,
): Promise<BufferedResponse> {
  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  const buffered = createBufferedResponse(
    response.status,
    response.statusText,
    response.headers,
    bytes,
  )

  if (httpErrors && response.status >= 400) {
    const error = new HttpError({
      url: requestUrl,
      method: requestMethod,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: buffered.text(),
      response: buffered,
    })

    // Strip bufferAndCheck from the top of the stack trace — it's an
    // internal detail that adds noise. V8-only (Node, Chrome, Edge);
    // other engines keep the default trace. Only runs on error so
    // there's zero cost on the happy path.
    if (hasV8StackTraceApi(Error)) {
      Error.captureStackTrace(error, bufferAndCheck)
    }

    throw error
  }

  return buffered
}

/**
 * Compose wrapping middlewares around a core fetch function.
 * The first wrapper in the array is outermost (wraps from right to left).
 */
function composeFetchChain(
  coreFetch: (opts: RequestOptions) => Promise<BufferedResponse>,
  wrappers: WrappingMiddleware[],
): (opts: RequestOptions) => Promise<BufferedResponse> {
  let chain = coreFetch
  for (let i = wrappers.length - 1; i >= 0; i--) {
    const wrapper = wrappers[i]
    const next = chain
    chain = (opts) => wrapper(opts, next)
  }
  return chain
}

/**
 * Run all beforeRequest transforms sequentially, returning the final options.
 */
function runBeforeRequest(opts: RequestOptions, transforms: TransformMiddleware[]): RequestOptions {
  let result = opts
  for (const mw of transforms) {
    if (mw.beforeRequest) {
      result = mw.beforeRequest(result)
    }
  }
  return result
}

/**
 * Run all afterResponse transforms sequentially, returning the final response.
 */
function runAfterResponse(
  response: BufferedResponse,
  transforms: TransformMiddleware[],
): BufferedResponse {
  let result = response
  for (const mw of transforms) {
    if (mw.afterResponse) {
      result = mw.afterResponse(result)
    }
  }
  return result
}

function responseOf<T>(
  source: {status: number; statusText: string; headers: Headers},
  body: T,
): {status: number; statusText: string; headers: Headers; body: T} {
  return {status: source.status, statusText: source.statusText, headers: source.headers, body}
}

/**
 * V8 (Node, Chrome, Edge) exposes `Error.captureStackTrace` which lets us
 * strip internal frames from the stack trace so end-users only see relevant
 * call sites. This type guard enables its use without type assertions — the
 * API simply doesn't exist on non-V8 engines, where this is a no-op.
 */
function hasV8StackTraceApi(ctor: ErrorConstructor): ctor is ErrorConstructor & {
  captureStackTrace(error: Error, omitFramesAbove: (...args: never) => unknown): void
} {
  return 'captureStackTrace' in ctor
}
