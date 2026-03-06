import type {
  BufferedResponse,
  CreateRequestOptions,
  FetchFunction,
  FetchInit,
  JsonResponse,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TransformMiddleware,
  WrappingMiddleware,
} from './types'
import {createBufferedResponse} from './response'
import {HttpError} from './types'

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

function isTransformMiddleware(
  mw: TransformMiddleware | WrappingMiddleware,
): mw is TransformMiddleware {
  return typeof mw === 'object'
}

/**
 * Build the URL, headers, and fetch init from request options.
 * Shared by all `as` modes.
 */
function buildFetchArgs(
  opts: RequestOptions,
  instanceBase: string | undefined,
  instanceHeaders: Record<string, string> | undefined,
  instanceTimeout: number | false | undefined,
): {url: string; init: FetchInit} {
  // Base URL — prepend base if URL is not absolute
  let url = opts.url
  if (instanceBase && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = instanceBase + url
  }

  // Query string — merge query params into URL
  if (opts.query) {
    const urlObj = new URL(url)
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) {
        urlObj.searchParams.set(key, String(value))
      }
    }
    url = urlObj.toString()
  }

  // Merge instance headers with per-request headers
  const headers: Record<string, string> = {
    ...instanceHeaders,
    ...opts.headers,
  }

  // Build fetch init
  const init: FetchInit = {}
  if (opts.method) init.method = opts.method
  if (Object.keys(headers).length > 0) init.headers = headers

  // JSON request body — auto-serialize plain objects and arrays
  if (opts.body !== undefined && opts.body !== null) {
    if (typeof opts.body === 'string') {
      init.body = opts.body
    } else if (isPlainObject(opts.body) || Array.isArray(opts.body)) {
      init.body = JSON.stringify(opts.body)
      headers['content-type'] = 'application/json'
      init.headers = headers
    } else if (
      opts.body instanceof Uint8Array ||
      opts.body instanceof ArrayBuffer ||
      opts.body instanceof ReadableStream ||
      opts.body instanceof Blob
    ) {
      init.body = opts.body
    } else if (typeof FormData !== 'undefined' && opts.body instanceof FormData) {
      init.body = opts.body
    } else if (typeof URLSearchParams !== 'undefined' && opts.body instanceof URLSearchParams) {
      init.body = opts.body
    }
  }

  // Timeout — resolve timeout value (per-request wins over instance)
  const timeoutValue = opts.timeout !== undefined ? opts.timeout : instanceTimeout

  // Signal — build the final abort signal
  let signal: AbortSignal | undefined = opts.signal
  if (timeoutValue !== undefined && timeoutValue !== false) {
    const timeoutSignal = AbortSignal.timeout(timeoutValue)
    if (signal) {
      signal = AbortSignal.any([signal, timeoutSignal])
    } else {
      signal = timeoutSignal
    }
  }
  if (signal) init.signal = signal

  return {url, init}
}

/**
 * Buffer the response body and create a BufferedResponse.
 * Optionally throws HttpError for error status codes.
 */
async function bufferAndCheck(
  response: {status: number; statusText: string; headers: Headers; arrayBuffer(): Promise<ArrayBuffer>},
  httpErrors: boolean,
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
    throw new HttpError({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: buffered.text(),
      response: buffered,
    })
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
function runBeforeRequest(
  opts: RequestOptions,
  transforms: TransformMiddleware[],
): RequestOptions {
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

export function createRequest(options?: CreateRequestOptions): RequestFunction {
  const instanceFetch = options?.fetch
  const instanceHeaders = options?.headers
  const instanceBase = options?.base
  const instanceHttpErrors = options?.httpErrors
  const instanceTimeout = options?.timeout

  // Separate middleware into transforms and wrappers by shape
  const middleware = options?.middleware ?? []
  const transforms: TransformMiddleware[] = []
  const wrappers: WrappingMiddleware[] = []
  for (const mw of middleware) {
    if (isTransformMiddleware(mw)) {
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
    const {url, init} = buildFetchArgs(opts, instanceBase, instanceHeaders, instanceTimeout)
    const response = await fetchFn(url, init)
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true
    return bufferAndCheck(response, httpErrors)
  }

  // Compose wrapping middlewares around the core fetch
  const fetchChain = composeFetchChain(coreFetchBuffered, wrappers)

  /**
   * Execute the full buffered pipeline:
   * beforeRequest transforms → wrapping chain → afterResponse transforms
   */
  async function executeBuffered(opts: RequestOptions): Promise<BufferedResponse> {
    const transformedOpts = runBeforeRequest(opts, transforms)
    const buffered = await fetchChain(transformedOpts)
    return runAfterResponse(buffered, transforms)
  }

  async function requestBuffered(opts: RequestOptions): Promise<BufferedResponse> {
    return executeBuffered(opts)
  }

  async function requestJson(opts: RequestOptions): Promise<JsonResponse> {
    const buffered = await executeBuffered(opts)
    const parsed: unknown = JSON.parse(buffered.text())
    return {
      status: buffered.status,
      statusText: buffered.statusText,
      headers: buffered.headers,
      body: parsed,
    }
  }

  async function requestText(opts: RequestOptions): Promise<TextResponse> {
    const buffered = await executeBuffered(opts)
    return {
      status: buffered.status,
      statusText: buffered.statusText,
      headers: buffered.headers,
      body: buffered.text(),
    }
  }

  async function requestStream(opts: RequestOptions): Promise<StreamResponse> {
    // Stream mode: only beforeRequest transforms apply.
    // No wrapping middleware or afterResponse transforms.
    const transformedOpts = runBeforeRequest(opts, transforms)

    const fetchFn: FetchFunction = transformedOpts.fetch ?? instanceFetch ?? globalThis.fetch
    const {url, init} = buildFetchArgs(transformedOpts, instanceBase, instanceHeaders, instanceTimeout)
    const response = await fetchFn(url, init)
    const httpErrors = transformedOpts.httpErrors ?? instanceHttpErrors ?? true

    // For stream mode with httpErrors, check status and throw with buffered error body
    if (httpErrors && response.status >= 400) {
      await bufferAndCheck(response, httpErrors)
    }

    const streamBody = response.body ?? new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: streamBody,
    }
  }

  // Overloaded request function — each overload dispatches to the
  // appropriately-typed helper, so no type assertions are needed.
  function request<T = unknown>(options: RequestOptions & {as: 'json'}): Promise<JsonResponse<T>>
  function request(options: RequestOptions & {as: 'text'}): Promise<TextResponse>
  function request(options: RequestOptions & {as: 'stream'}): Promise<StreamResponse>
  function request(options: RequestOptions): Promise<BufferedResponse>
  function request(url: string): Promise<BufferedResponse>
  function request(
    input: string | RequestOptions,
  ): Promise<BufferedResponse | JsonResponse | TextResponse | StreamResponse> {
    const opts: RequestOptions = typeof input === 'string' ? {url: input} : input

    switch (opts.as) {
      case 'json':
        return requestJson(opts)
      case 'text':
        return requestText(opts)
      case 'stream':
        return requestStream(opts)
      default:
        return requestBuffered(opts)
    }
  }

  return request
}
