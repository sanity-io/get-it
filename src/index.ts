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
} from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
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
 * Buffer the response body and throw HttpError if needed.
 */
async function bufferAndCheck(
  response: {status: number; statusText: string; headers: Headers; arrayBuffer(): Promise<ArrayBuffer>},
  httpErrors: boolean,
): Promise<{bytes: Uint8Array; buffered: BufferedResponse}> {
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

  return {bytes, buffered}
}

export function createRequest(options?: CreateRequestOptions): RequestFunction {
  const instanceFetch = options?.fetch
  const instanceHeaders = options?.headers
  const instanceBase = options?.base
  const instanceHttpErrors = options?.httpErrors
  const instanceTimeout = options?.timeout

  // Each mode gets its own function so the return types are precise —
  // no type assertions needed.

  async function requestBuffered(opts: RequestOptions): Promise<BufferedResponse> {
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch
    const {url, init} = buildFetchArgs(opts, instanceBase, instanceHeaders, instanceTimeout)
    const response = await fetchFn(url, init)
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true
    const {buffered} = await bufferAndCheck(response, httpErrors)
    return buffered
  }

  async function requestJson(opts: RequestOptions): Promise<JsonResponse> {
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch
    const {url, init} = buildFetchArgs(opts, instanceBase, instanceHeaders, instanceTimeout)
    const response = await fetchFn(url, init)
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true

    // Buffer and check for errors first
    const {buffered} = await bufferAndCheck(response, httpErrors)

    // Parse JSON from buffered text
    const parsed: unknown = JSON.parse(buffered.text())
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: parsed,
    }
  }

  async function requestText(opts: RequestOptions): Promise<TextResponse> {
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch
    const {url, init} = buildFetchArgs(opts, instanceBase, instanceHeaders, instanceTimeout)
    const response = await fetchFn(url, init)
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true

    // Buffer and check for errors first
    const {buffered} = await bufferAndCheck(response, httpErrors)

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: buffered.text(),
    }
  }

  async function requestStream(opts: RequestOptions): Promise<StreamResponse> {
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch
    const {url, init} = buildFetchArgs(opts, instanceBase, instanceHeaders, instanceTimeout)
    const response = await fetchFn(url, init)
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true

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
