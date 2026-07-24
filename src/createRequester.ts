import {HttpError, TimeoutError} from './errors'
import {createBufferedResponse} from './response'
import type {
  BufferedResponse,
  FetchBody,
  FetchFunction,
  FetchHeaders,
  FetchInit,
  FetchResponse,
  JsonResponse,
  RequesterOptions,
  RequestFunction,
  RequestOptions,
  StreamResponse,
  TextResponse,
  TimeoutOptions,
  TransformMiddleware,
  WrappingMiddleware,
} from './types'

/**
 * Creates a configured {@link RequestFunction} with shared defaults and middleware.
 *
 * @param options - Instance-level configuration (base URL, headers, timeout, middleware, etc.).
 * @returns A request function that can be called with a URL string or {@link RequestOptions}.
 *
 * @example
 * ```ts
 * const request = createRequester({base: 'https://api.example.com'})
 * const response = await request({url: '/users', as: 'json'})
 * ```
 *
 * @public
 */
export function createRequester(options: RequesterOptions & {as: 'json'}): RequestFunction<'json'>
/** Creates a requester that returns {@link TextResponse} by default. @public */
export function createRequester(options: RequesterOptions & {as: 'text'}): RequestFunction<'text'>
/** Creates a requester that returns {@link StreamResponse} by default. @public */
export function createRequester(
  options: RequesterOptions & {as: 'stream'},
): RequestFunction<'stream'>
/** Creates a requester that returns {@link BufferedResponse} by default. @public */
export function createRequester(options?: RequesterOptions): RequestFunction
export function createRequester(
  options?: RequesterOptions,
): RequestFunction<'json' | 'text' | 'stream' | undefined> {
  const instanceFetch = options?.fetch
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
   * Builds fetch args, applies the headers-phase timeout when configured,
   * and performs the fetch. Lives inside the wrapping-middleware chain, so
   * each retry() attempt gets a fresh headers timer.
   */
  async function performFetch(
    fetchFn: FetchFunction,
    opts: RequestOptions,
  ): Promise<{
    response: FetchResponse
    url: string
    method: string
    totalDeadline: Promise<never> | undefined
  }> {
    const {totalMs, headersMs, attachSignal} = resolveTimeout(
      opts.timeout !== undefined ? opts.timeout : instanceTimeout,
    )
    // In rejection-only mode the total deadline must not become a fetch-init
    // signal, so it is withheld from buildFetchArgs and raced below instead.
    const {url, init} = buildFetchArgs(
      opts,
      attachSignal ? totalMs : undefined,
      instanceCredentials,
    )
    const method = init.method ?? 'GET'

    // Rejection-only mode (`timeout: {signal: false}`): enforce the total
    // deadline by racing the request promise instead of aborting the fetch,
    // rejecting with the same TimeoutError DOMException the abort-based path
    // produces. The fetch itself keeps running to completion in the
    // background — the caller opted out of teardown (e.g. so Next.js RSC
    // request memoization stays enabled) — and its late settlement is
    // swallowed in the catch block below.
    const totalDeadline =
      !attachSignal && totalMs !== undefined
        ? rejectAfterTimeout(
            totalMs,
            new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
          )
        : undefined

    if (headersMs === undefined && totalDeadline === undefined) {
      return {response: await fetchFn(url, init), url, method, totalDeadline}
    }

    // Deadlines competing with the fetch to settle the request promise.
    const deadlines: Promise<never>[] = totalDeadline === undefined ? [] : [totalDeadline]

    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    if (headersMs !== undefined) {
      // Created eagerly so the stack trace points at the request call site
      // rather than an empty timer-callback stack.
      const timeoutError = new TimeoutError({url, method, timeoutMs: headersMs, phase: 'headers'})
      // Reject via Promise.race rather than relying on fetch to reject with the
      // abort reason: workerd's fetch reconstructs the reason (losing its
      // prototype, so `instanceof TimeoutError` breaks), and WebKit has dropped
      // the reason — or ignored `AbortSignal.any`-derived aborts entirely.
      // In rejection-only mode there is no controller — the race alone rejects.
      controller = attachSignal ? new AbortController() : undefined
      deadlines.push(
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(timeoutError)
            controller?.abort(timeoutError)
          }, headersMs)
        }),
      )
    }

    // Without a controller (rejection-only mode) the init is passed through
    // untouched, so a caller-provided signal reaches fetch as-is.
    const signal =
      controller && init.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : (controller?.signal ?? init.signal)
    // fetchFn is invoked inside the try so a synchronous throw still clears
    // the headers timer — otherwise the orphaned deadline would later reject
    // with nothing subscribed to it.
    let fetching: Promise<FetchResponse> | undefined
    try {
      fetching = Promise.resolve(
        controller ? fetchFn(url, {...init, signal}) : fetchFn(url, init),
      )
      return {response: await Promise.race([fetching, ...deadlines]), url, method, totalDeadline}
    } catch (reason) {
      // A deadline won the race (or the fetch itself failed): the fetch's
      // later settlement must not become an unhandled rejection. In
      // rejection-only mode the fetch was not aborted, so a late response
      // arrives with a dangling body — cancel it to release the connection.
      fetching?.then((response) => response.body?.cancel()).catch(() => {})
      throw reason
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Core fetch + buffer function. This is the innermost layer
   * that wrapping middlewares eventually call.
   */
  async function getItBuffered(opts: RequestOptions): Promise<BufferedResponse> {
    const fetchFn: FetchFunction = opts.fetch ?? instanceFetch ?? globalThis.fetch
    const {response, url, method, totalDeadline} = await performFetch(fetchFn, opts)
    const httpErrors = opts.httpErrors ?? instanceHttpErrors ?? true
    // The rejection-only total deadline covers body download too, so keep
    // racing it while buffering (abort mode covers this via the init signal).
    return raceDeadline(bufferAndCheck(response, httpErrors, url, method), totalDeadline)
  }

  // Compose wrapping middlewares around the core fetch
  const fetchChain = composeFetchChain(getItBuffered, wrappers)

  async function requestJson(opts: RequestOptions): Promise<JsonResponse> {
    const transformedOpts = runBeforeRequest(opts, transforms)
    const buffered = runAfterResponse(
      await fetchChain(transformedOpts),
      transformedOpts,
      transforms,
    )
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
    const buffered = runAfterResponse(
      await fetchChain(transformedOpts),
      transformedOpts,
      transforms,
    )
    return responseOf(buffered, buffered.text())
  }

  async function requestStream(opts: RequestOptions): Promise<StreamResponse> {
    // Stream mode: beforeRequest transforms + wrapping middleware apply.
    // afterResponse transforms do NOT apply (there is no BufferedResponse to transform).
    const transformedOpts = runBeforeRequest(opts, transforms)

    // Capture the raw fetch response so we can extract the stream after
    // the wrapping middleware chain completes.
    let capturedResponse: FetchResponse | undefined

    async function getItStreamed(reqOpts: RequestOptions): Promise<BufferedResponse> {
      const fetchFn: FetchFunction = reqOpts.fetch ?? instanceFetch ?? globalThis.fetch
      const {response, url, method, totalDeadline} = await performFetch(fetchFn, reqOpts)
      const httpErrors = reqOpts.httpErrors ?? instanceHttpErrors ?? true

      if (httpErrors && response.status >= 400) {
        return raceDeadline(bufferAndCheck(response, httpErrors, url, method), totalDeadline)
      }

      // A rejection-only total deadline cannot govern the stream from here on
      // — a stream already handed to the caller cannot be retracted — so with
      // `signal: false` it only covers up to response headers. The deadline
      // promise is pre-armed with a catch handler, so its eventual rejection
      // stays handled.
      capturedResponse = response
      return createBufferedResponse(
        response.status,
        response.statusText,
        response.headers,
        new Uint8Array(0),
      )
    }

    defineFnName(getItStreamed, 'getItStreamed')

    const streamChain = composeFetchChain(getItStreamed, wrappers)
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
      headers: mergeHeaders(options?.headers, raw.headers),
    }

    switch (opts.as ?? options?.as) {
      case 'json':
        return await requestJson(opts)
      case 'text':
        return await requestText(opts)
      case 'stream':
        return await requestStream(opts)
      default: {
        const transformedOpts = runBeforeRequest(opts, transforms)
        const buffered = runAfterResponse(
          await fetchChain(transformedOpts),
          transformedOpts,
          transforms,
        )
        return buffered
      }
    }
  }

  defineFnName(performFetch, 'performFetch')
  defineFnName(getItBuffered, 'getItBuffered')
  defineFnName(requestStream, 'requestStream')
  defineFnName(requestJson, 'requestJson')
  defineFnName(requestText, 'requestText')
  defineFnName(request, 'request')

  return request
}

/**
 * Resolved per-request timeout configuration. `undefined` means the phase
 * is disabled.
 * @internal
 */
export interface ResolvedTimeout {
  totalMs: number | undefined
  headersMs: number | undefined
  /**
   * When `false` (`timeout: {signal: false}`), timeouts are rejection-only:
   * the request promise rejects at the deadline but no timeout-derived abort
   * signal is attached to the fetch init.
   */
  attachSignal: boolean
}

/**
 * Normalizes a `timeout` option value into per-phase millisecond values.
 * `false` and values <= 0 disable a phase; an omitted `total` falls back to
 * the 120 000 ms default. A plain number or `false` is total-only shorthand.
 * @internal
 */
export function resolveTimeout(
  value: number | false | TimeoutOptions | undefined,
): ResolvedTimeout {
  if (typeof value === 'number' || value === false) {
    return {totalMs: enabledMs(value), headersMs: undefined, attachSignal: true}
  }
  return {
    totalMs: value?.total === undefined ? 120_000 : enabledMs(value.total),
    headersMs: enabledMs(value?.headers),
    attachSignal: value?.signal !== false,
  }
}

function enabledMs(value: number | false | undefined): number | undefined {
  if (value === undefined || value === false || value <= 0) return undefined
  return value
}

/**
 * Prevents a pending deadline timer from holding the Node.js event loop open
 * for the full timeout window; no-op on platforms without timer.unref().
 */
function unrefTimer(timer: unknown): void {
  if (
    typeof timer === 'object' &&
    timer !== null &&
    'unref' in timer &&
    typeof timer.unref === 'function'
  ) {
    timer.unref()
  }
}

/**
 * Creates the rejection-only (`timeout: {signal: false}`) total deadline: a
 * promise that rejects with `reason` once `ms` elapses. Pre-armed with a
 * no-op catch handler so the rejection never becomes "unhandled" when the
 * guarded work settles first — like the abort-based total deadline, the timer
 * is unref'd rather than cleared, and firing after the race is won is
 * harmless.
 */
function rejectAfterTimeout(ms: number, reason: unknown): Promise<never> {
  const deadline = new Promise<never>((_, reject) => {
    unrefTimer(setTimeout(() => reject(reason), ms))
  })
  deadline.catch(() => {})
  return deadline
}

/**
 * Awaits `work` while a rejection-only total deadline keeps racing it. If the
 * deadline wins, `work` continues in the background — its eventual settlement
 * is swallowed so it cannot become an unhandled rejection.
 */
async function raceDeadline<T>(work: Promise<T>, deadline: Promise<never> | undefined): Promise<T> {
  if (deadline === undefined) return work
  try {
    return await Promise.race([work, deadline])
  } catch (reason) {
    work.catch(() => {})
    throw reason
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

/**
 * Type guard narrowing an `unknown` request body to a binary `FetchBody`.
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
 * Merge two FetchHeaders values into a plain Record so that middleware
 * can safely spread the result (Headers instances have no enumerable
 * own properties and would be lost on `{ ...opts.headers }`).
 * The second argument wins on conflicts.
 */
function mergeHeaders(
  base: FetchHeaders | undefined,
  override: FetchHeaders | undefined,
): Record<string, string> {
  const headers = new Headers(base ? sanitizeHeaders(base) : undefined)
  if (override) {
    new Headers(sanitizeHeaders(override)).forEach((value, key) => {
      headers.set(key, value)
    })
  }
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

/**
 * Build the URL, headers, and fetch init from request options.
 * Expects headers to already be merged (via mergeHeaders in request()).
 */
function buildFetchArgs(
  opts: RequestOptions,
  totalMs: number | undefined,
  instanceCredentials: 'include' | 'omit' | 'same-origin' | undefined,
): {url: string; init: FetchInit} {
  let url = opts.url

  // Query string — merge query params into URL
  if (opts.query) {
    const entries =
      opts.query instanceof URLSearchParams ? opts.query.entries() : Object.entries(opts.query)
    const params = new URLSearchParams()
    for (const [key, value] of entries) {
      if (value === undefined) continue
      params.append(key, `${value}`)
    }
    const qs = params.toString()
    if (qs) {
      const fragmentStart = url.indexOf('#')
      const urlWithoutFragment = fragmentStart === -1 ? url : url.slice(0, fragmentStart)
      const fragment = fragmentStart === -1 ? '' : url.slice(fragmentStart)
      url = `${urlWithoutFragment}${urlWithoutFragment.includes('?') ? '&' : '?'}${qs}${fragment}`
    }
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

  // Signal — build the final abort signal (totalMs already resolved by resolveTimeout)
  let signal: AbortSignal | undefined = opts.signal
  if (totalMs !== undefined) {
    // Own the deadline timer instead of using AbortSignal.timeout(): WebKit
    // can garbage-collect an otherwise-unreferenced timeout signal behind
    // AbortSignal.any(), silently disarming the deadline. The timer callback
    // closure keeps this controller (and thus the abort chain) alive.
    const totalController = new AbortController()
    unrefTimer(
      setTimeout(
        () =>
          totalController.abort(
            new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
          ),
        totalMs,
      ),
    )
    signal = signal ? AbortSignal.any([signal, totalController.signal]) : totalController.signal
  }
  if (signal) init.signal = signal

  const credentials = opts.credentials ?? instanceCredentials
  if (credentials !== undefined) init.credentials = credentials

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
  options: RequestOptions,
  transforms: TransformMiddleware[],
): BufferedResponse {
  let result = response
  for (const mw of transforms) {
    if (mw.afterResponse) {
      result = mw.afterResponse(result, options)
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

// Ensure function name is kept in minified/mangled stack traces
function defineFnName(fn: Function, name: string): void {
  Object.defineProperty(fn, 'name', {value: name})
}
