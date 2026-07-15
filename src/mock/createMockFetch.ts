import type {FetchFunction, FetchResponse} from '../types'
import {blobToBytes, contentTypeFor, normalizeExpectedBody} from './body'
import {bytesEqual, isBinaryBody, toBytes} from './bytes'
import type {Diff} from './diff'
import {diffValues} from './diff'
import type {MockDescription} from './errors'
import {MockFetchError} from './errors'
import type {AsymmetricMatcher} from './matchers'
import {deepMatch, isAsymmetricMatcher, isRecord} from './matchers'
import {matchUrl, parseUrl} from './urlMatch'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options for matching a request beyond method and URL.
 * @public
 */
export interface MockMatchOptions {
  query?: Record<string, string | number | boolean> | AsymmetricMatcher
  body?: unknown
  headers?: Record<string, string | AsymmetricMatcher> | AsymmetricMatcher
}

/**
 * Definition for a mock response.
 * @public
 */
export interface MockResponseDef {
  status?: number
  statusText?: string
  body?: unknown
  headers?: Record<string, string>
  /**
   * Delay in milliseconds before the response resolves, simulating server
   * response time. The request is treated as sent immediately; this is how
   * long the "server" takes to respond. Values <= 0 resolve immediately.
   */
  delay?: number
}

/**
 * A recorded request captured by the mock.
 * @public
 */
export interface RecordedRequest {
  method: string
  url: string
  fullUrl: string
  query: Record<string, string>
  headers: Headers
  body: unknown
}

/**
 * Handler builder returned by `.on()` / `.onAny()`.
 * @public
 */
export interface MockHandler {
  respond(def: MockResponseDef): MockHandler
  respondPersist(def: MockResponseDef): MockHandler
  /**
   * Reject the matched request with a transport-level error (mirrors how a real
   * `fetch()` rejects on a failed connection), instead of resolving to a
   * `Response`. Accepts an `Error` instance, or a factory invoked once per
   * consumption so each rejection gets a fresh instance. The value is thrown
   * unmodified, preserving `name`/`message`/`cause`.
   */
  respondWithError(error: Error | (() => Error)): MockHandler
  /** Like {@link respondWithError}, but rejects on every matching request. */
  respondWithErrorPersist(error: Error | (() => Error)): MockHandler
}

/**
 * A scoped view of the mock, constraining handlers and requests to a specific origin.
 * @public
 */
export interface MockScope {
  on(
    method: string,
    url: string | ((url: string) => boolean),
    options?: MockMatchOptions,
  ): MockHandler
  onAny(url: string | ((url: string) => boolean), options?: MockMatchOptions): MockHandler
  getRequests(): ReadonlyArray<RecordedRequest>
  assertAllConsumed(): void
}

/**
 * The mock fetch instance returned by `createMockFetch()`.
 * @public
 */
export interface MockFetch {
  fetch: FetchFunction
  on(
    method: string,
    url: string | ((url: string) => boolean),
    options?: MockMatchOptions,
  ): MockHandler
  onAny(url: string | ((url: string) => boolean), options?: MockMatchOptions): MockHandler
  getRequests(): ReadonlyArray<RecordedRequest>
  assertAllConsumed(): void
  clear(): void
  scope(baseUrl: string): MockScope
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type ResponseEntry =
  | {kind: 'response'; def: MockResponseDef; persistent: boolean; consumed: boolean}
  | {kind: 'error'; error: Error | (() => Error); persistent: boolean; consumed: boolean}

interface InternalHandler {
  method: string | null // null = any method
  origin: string // empty string = match any origin; non-empty = must match
  urlPatternPath: string | ((url: string) => boolean) // path portion only (no query)
  patternQuery: Record<string, string> // query parsed from the url pattern
  matchOptions: MockMatchOptions
  responses: ResponseEntry[]
  normalizedBody?: {value: unknown}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a headers-like value is a `Headers` instance.
 * @internal
 */
function isHeaders(value: unknown): value is Headers {
  return typeof value === 'object' && value !== null && value instanceof Headers
}

/**
 * Get the content-type from a Headers object.
 * @internal
 */
function getContentType(headers: Headers): string | null {
  return headers.get('content-type')
}

/**
 * Build a lowercased-key record of a request's headers for matching.
 * `Headers.forEach` already yields lowercased names.
 * @internal
 */
function toHeaderRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

/**
 * Whether a handler constrains request headers.
 * @internal
 */
function hasHeadersConstraint(handler: InternalHandler): boolean {
  return handler.matchOptions.headers !== undefined
}

/**
 * Match a handler's `headers` constraint against a request's headers.
 * Containing semantics; keys are case-insensitive (compared lowercased).
 * @internal
 */
function headersMatch(handler: InternalHandler, headerRecord: Record<string, string>): boolean {
  const expected = handler.matchOptions.headers
  if (expected === undefined) return true
  if (isAsymmetricMatcher(expected)) return expected.asymmetricMatch(headerRecord)
  return Object.keys(expected).every((key) => {
    const lower = key.toLowerCase()
    return lower in headerRecord && deepMatch(expected[key], headerRecord[lower])
  })
}

/**
 * Try to parse a JSON string. Returns the parsed value on success, or undefined on failure.
 * @internal
 */
function tryParseJson(value: string): {parsed: unknown} | undefined {
  try {
    return {parsed: JSON.parse(value)}
  } catch {
    return undefined
  }
}

/**
 * Drain a readable stream fully into a single `Uint8Array`. Only the mock's
 * async `fetch` can safely consume a request-body stream once.
 * @internal
 */
async function drainStream(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    const value: unknown = chunk.value
    // Request-body streams yield binary chunks; anything else is ignored.
    if (value instanceof Uint8Array) {
      chunks.push(value)
      total += value.byteLength
    } else if (value instanceof ArrayBuffer) {
      const bytes = new Uint8Array(value)
      chunks.push(bytes)
      total += bytes.byteLength
    }
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

/**
 * Match a request body against a handler's expected body. Raw binary
 * (`Uint8Array` / `ArrayBuffer`) is compared byte-for-byte; everything else
 * (including the `bodyBytes()` and other asymmetric matchers) falls through to
 * structural `deepMatch`.
 * @internal
 */
function matchBody(expected: unknown, actual: unknown): boolean {
  if (isBinaryBody(expected)) {
    return actual instanceof Uint8Array && bytesEqual(toBytes(expected), actual)
  }
  return deepMatch(expected, actual)
}

/**
 * The handler's expected body, normalized if it was a native body type.
 * @internal
 */
function expectedBodyOf(handler: InternalHandler): unknown {
  return handler.normalizedBody ? handler.normalizedBody.value : handler.matchOptions.body
}

/**
 * Resolve an error entry to the error to throw. A factory function is invoked
 * once per consumption so each rejection gets a fresh instance; the resulting
 * value is thrown unmodified.
 * @internal
 */
function resolveError(error: Error | (() => Error)): Error {
  return typeof error === 'function' ? error() : error
}

/**
 * Wait `ms` milliseconds, rejecting with the signal's reason if it aborts
 * first. Clears the timer on abort so it cannot resolve a request that should
 * already have rejected.
 * @internal
 */
function delayWithAbort(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, {once: true})
  })
}

/**
 * Build a FetchResponse-compatible object from a MockResponseDef.
 * @internal
 */
function buildFetchResponse(def: MockResponseDef, url: string): FetchResponse {
  const status = def.status ?? 200
  const ok = status >= 200 && status < 300
  const statusText = def.statusText ?? statusTextForCode(status)
  const responseHeaders = new Headers(def.headers)

  let bodyString: string
  if (def.body === undefined || def.body === null) {
    bodyString = ''
  } else if (typeof def.body === 'string') {
    bodyString = def.body
  } else {
    bodyString = JSON.stringify(def.body)
    if (!responseHeaders.has('content-type')) {
      responseHeaders.set('content-type', 'application/json')
    }
  }

  const bodyBytes = new TextEncoder().encode(bodyString)

  const stream =
    bodyString.length > 0
      ? new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bodyBytes)
            controller.close()
          },
        })
      : null

  return {
    ok,
    status,
    statusText,
    headers: responseHeaders,
    url,
    redirected: false,
    body: stream,
    text(): Promise<string> {
      return Promise.resolve(bodyString)
    },
    arrayBuffer(): Promise<ArrayBuffer> {
      return Promise.resolve(
        bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
      )
    },
  }
}

/**
 * Map common HTTP status codes to their status text.
 * @internal
 */
function statusTextForCode(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  }
  return map[code] ?? ''
}

/**
 * Check whether a handler's origin matches the incoming request's origin.
 * If the handler origin is empty, it matches any origin (path-only matching).
 * @internal
 */
function originMatches(handler: InternalHandler, requestOrigin: string): boolean {
  if (handler.origin === '') return true
  return handler.origin === requestOrigin
}

/**
 * Get a human-readable description for a handler.
 * @internal
 */
function describeHandler(handler: InternalHandler): string {
  const method = handler.method ?? 'ANY'
  let urlPart: string
  if (typeof handler.urlPatternPath === 'function') {
    urlPart = '<function predicate>'
  } else {
    urlPart =
      handler.origin !== '' ? `${handler.origin}${handler.urlPatternPath}` : handler.urlPatternPath
  }
  // Asymmetric matchers are plain objects too, so they can't be serialized as a
  // key/value query string — render a placeholder instead. A URL-pattern query
  // string cannot be combined with an asymmetric matcher (rejected at
  // registration time), so `patternQuery` is empty here.
  if (isAsymmetricMatcher(handler.matchOptions.query)) {
    urlPart += `?<asymmetric query matcher>`
  } else {
    const queryKeys = Object.keys(handler.patternQuery)
    const optionQueryKeys = isRecord(handler.matchOptions.query)
      ? Object.keys(handler.matchOptions.query)
      : []
    const allQueryKeys = [...new Set([...queryKeys, ...optionQueryKeys])]
    if (allQueryKeys.length > 0) {
      const mergedQuery: Record<string, string> = {}
      for (const key of queryKeys) {
        mergedQuery[key] = handler.patternQuery[key]
      }
      if (isRecord(handler.matchOptions.query)) {
        for (const key of Object.keys(handler.matchOptions.query)) {
          mergedQuery[key] = String(handler.matchOptions.query[key])
        }
      }
      const queryStr = new URLSearchParams(mergedQuery).toString()
      if (queryStr) {
        urlPart += `?${queryStr}`
      }
    }
  }
  return `${method} ${urlPart}`
}

/**
 * Count remaining (unconsumed, non-persistent or persistent) responses for a handler.
 * @internal
 */
function responsesRemaining(handler: InternalHandler): number {
  let count = 0
  for (const entry of handler.responses) {
    if (entry.persistent) return Infinity
    if (!entry.consumed) count++
  }
  return count
}

/**
 * Check whether a handler has any query constraint (from URL pattern or options).
 * When false, the handler matches any query params.
 * @internal
 */
function hasQueryConstraint(handler: InternalHandler): boolean {
  return Object.keys(handler.patternQuery).length > 0 || handler.matchOptions.query !== undefined
}

/**
 * Check whether the handler's query constraint matches the actual query.
 * Returns true if there's no constraint or if it matches.
 * @internal
 */
function queryMatches(handler: InternalHandler, query: Record<string, string>): boolean {
  if (!hasQueryConstraint(handler)) return true
  const mergedExpectedQuery = mergeQueryMatchers(handler.patternQuery, handler.matchOptions.query)
  return deepMatch(mergedExpectedQuery, query)
}

/**
 * Score how well a handler matches a request. Higher is better.
 * Returns 0-5 based on which dimensions match.
 * @internal
 */
function scoreMatch(
  handler: InternalHandler,
  method: string,
  origin: string,
  path: string,
  query: Record<string, string>,
  body: unknown,
  headerRecord: Record<string, string>,
): number {
  let score = 0

  // Origin match
  if (originMatches(handler, origin)) {
    score += 1
  }

  // Method match
  if (handler.method === null || handler.method === method) {
    score += 1
  }

  // URL match
  if (matchUrl(handler.urlPatternPath, path)) {
    score += 1
  }

  // Query match
  if (queryMatches(handler, query)) {
    score += 1
  }

  // Body match
  if (handler.matchOptions.body === undefined || matchBody(expectedBodyOf(handler), body)) {
    score += 1
  }

  // Headers match
  if (!hasHeadersConstraint(handler) || headersMatch(handler, headerRecord)) {
    score += 1
  }

  return score
}

/**
 * Merge query params from the URL pattern with query params from options.
 * @internal
 */
function mergeQueryMatchers(
  patternQuery: Record<string, string>,
  optionsQuery: Record<string, string | number | boolean> | AsymmetricMatcher | undefined,
): Record<string, string> | AsymmetricMatcher {
  // Combining a URL-pattern query with an asymmetric matcher is rejected at
  // registration time, so here an asymmetric matcher always implies an empty
  // patternQuery and can be returned directly.
  if (isAsymmetricMatcher(optionsQuery)) {
    return optionsQuery
  }
  const merged: Record<string, string> = {...patternQuery}
  if (isRecord(optionsQuery)) {
    for (const key of Object.keys(optionsQuery)) {
      // Query params are always strings; coerce author-supplied numbers/booleans
      // so {limit: 10} matches "10".
      merged[key] = String(optionsQuery[key])
    }
  }
  return merged
}

/**
 * Build diff details for the closest handler versus the actual request.
 * @internal
 */
function buildDiffs(
  handler: InternalHandler,
  method: string,
  origin: string,
  path: string,
  query: Record<string, string>,
  body: unknown,
  headerRecord: Record<string, string>,
): Diff[] {
  const diffs: Diff[] = []

  // Origin diff
  if (!originMatches(handler, origin)) {
    diffs.push({path: 'origin', expected: handler.origin, actual: origin})
  }

  // Method diff
  if (handler.method !== null && handler.method !== method) {
    diffs.push({path: 'method', expected: handler.method, actual: method})
  }

  // URL diff
  if (!matchUrl(handler.urlPatternPath, path)) {
    const expectedUrl =
      typeof handler.urlPatternPath === 'function' ? '<function>' : handler.urlPatternPath
    diffs.push({path: 'url', expected: expectedUrl, actual: path})
  }

  // Query diff
  if (!queryMatches(handler, query) && hasQueryConstraint(handler)) {
    const mergedExpectedQuery = mergeQueryMatchers(handler.patternQuery, handler.matchOptions.query)
    if (!isAsymmetricMatcher(mergedExpectedQuery)) {
      diffs.push(...diffValues('query', mergedExpectedQuery, query))
    } else {
      diffs.push({path: 'query', expected: mergedExpectedQuery, actual: query})
    }
  }

  // Body diff
  if (handler.matchOptions.body !== undefined && !matchBody(expectedBodyOf(handler), body)) {
    const expectedBody = expectedBodyOf(handler)
    const useStructuralDiff =
      (isRecord(expectedBody) || Array.isArray(expectedBody)) &&
      !isBinaryBody(expectedBody) &&
      !isBinaryBody(body)
    if (useStructuralDiff) {
      diffs.push(...diffValues('body', expectedBody, body))
    } else {
      diffs.push({path: 'body', expected: expectedBody, actual: body})
    }
  }

  // Headers diff
  if (hasHeadersConstraint(handler) && !headersMatch(handler, headerRecord)) {
    const expected = handler.matchOptions.headers
    if (expected === undefined || isAsymmetricMatcher(expected)) {
      diffs.push({path: 'headers', expected, actual: headerRecord})
    } else {
      for (const key of Object.keys(expected)) {
        const lower = key.toLowerCase()
        if (!(lower in headerRecord) || !deepMatch(expected[key], headerRecord[lower])) {
          diffs.push({path: `headers.${key}`, expected: expected[key], actual: headerRecord[lower]})
        }
      }
    }
  }

  return diffs
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Create a mock fetch instance for testing with `createRequester`.
 *
 * @example
 * ```ts
 * const mock = createMockFetch()
 * mock.on('GET', '/api/docs').respond({ status: 200, body: { items: [] } })
 *
 * const request = createRequester({
 *   base: 'https://api.example.com',
 *   fetch: mock.fetch,
 * })
 *
 * const res = await request({ url: '/api/docs', as: 'json' })
 * ```
 *
 * @public
 */
export function createMockFetch(): MockFetch {
  const handlers: InternalHandler[] = []
  const recordedRequests: RecordedRequest[] = []

  /**
   * The mock fetch function injected into createRequester via the `fetch` option.
   */
  const fetchFn: FetchFunction = async (input, init) => {
    const method = init?.method ?? 'GET'
    const parsed = parseUrl(input)
    const requestOrigin = parsed.origin
    const path = parsed.path
    const query = parsed.query

    // Normalize headers once — works for Headers, Record<string, string>, and [string, string][]
    const normalizedHeaders = isHeaders(init?.headers)
      ? new Headers(init.headers)
      : new Headers(init?.headers ?? undefined)

    // Parse / normalize the request body for recording and matching.
    let body: unknown = undefined
    const rawBody = init?.body
    if (rawBody !== undefined && rawBody !== null) {
      if (typeof rawBody === 'string') {
        const ct = getContentType(normalizedHeaders)
        if (ct !== null && ct.includes('application/json')) {
          const result = tryParseJson(rawBody)
          body = result !== undefined ? result.parsed : rawBody
        } else {
          body = rawBody
        }
      } else if (rawBody instanceof Uint8Array || rawBody instanceof ArrayBuffer) {
        // Store a defensive copy so the recorded body is a stable snapshot.
        // Note: a plain `new Uint8Array(...)` copy is used rather than
        // `toBytes(rawBody).slice()` because `Buffer` (a `Uint8Array`
        // subclass) overrides `slice()` to return another `Buffer`, which
        // `toEqual` treats as unequal to a plain `Uint8Array` snapshot.
        body = new Uint8Array(toBytes(rawBody))
      } else if (rawBody instanceof ReadableStream) {
        body = await drainStream(rawBody)
      } else if (rawBody instanceof Blob) {
        // File extends Blob; a bare blob/file body sends only bytes on the wire.
        body = await blobToBytes(rawBody)
      }
    }

    // Mirror platform fetch: set the default content-type for this body type
    // when the caller did not set one, so it is recorded and matchable.
    const synthesizedContentType = contentTypeFor(rawBody)
    if (synthesizedContentType !== null && !normalizedHeaders.has('content-type')) {
      normalizedHeaders.set('content-type', synthesizedContentType)
    }

    const headerRecord = toHeaderRecord(normalizedHeaders)

    // Record the request
    recordedRequests.push({
      method,
      url: path,
      fullUrl: input,
      query,
      headers: normalizedHeaders,
      body,
    })

    // Normalize native-type expected bodies once (async for Blob/FormData), cached per handler.
    for (const handler of handlers) {
      if (handler.matchOptions.body !== undefined && handler.normalizedBody === undefined) {
        handler.normalizedBody = {value: await normalizeExpectedBody(handler.matchOptions.body)}
      }
    }

    // Find matching handler
    for (const handler of handlers) {
      // Check origin
      if (!originMatches(handler, requestOrigin)) continue

      // Check method
      if (handler.method !== null && handler.method !== method) continue

      // Check URL path
      if (!matchUrl(handler.urlPatternPath, path)) continue

      // Check query
      if (!queryMatches(handler, query)) continue

      // Check body
      if (handler.matchOptions.body !== undefined && !matchBody(expectedBodyOf(handler), body)) {
        continue
      }

      // Check headers
      if (hasHeadersConstraint(handler) && !headersMatch(handler, headerRecord)) continue

      // Find first unconsumed response
      const responseEntry = findAvailableResponse(handler)
      if (responseEntry === undefined) continue

      // Consume non-persistent responses
      if (!responseEntry.persistent) {
        responseEntry.consumed = true
      }

      if (responseEntry.kind === 'error') {
        throw resolveError(responseEntry.error)
      }

      const {def} = responseEntry
      if (def.delay !== undefined && def.delay > 0) {
        await delayWithAbort(def.delay, init?.signal)
      }
      return buildFetchResponse(def, input)
    }

    // No match found — build error
    const allMocks: MockDescription[] = handlers.map((h) => ({
      description: describeHandler(h),
      responsesRemaining: responsesRemaining(h),
    }))

    // Find closest match
    let closestHandler: InternalHandler | undefined
    let closestScore = -1
    for (const handler of handlers) {
      const score = scoreMatch(handler, method, requestOrigin, path, query, body, headerRecord)
      if (score > closestScore) {
        closestScore = score
        closestHandler = handler
      }
    }

    let diffs: Diff[] = []
    let closestDescription: string | undefined
    if (closestHandler !== undefined) {
      closestDescription = describeHandler(closestHandler)
      diffs = buildDiffs(closestHandler, method, requestOrigin, path, query, body, headerRecord)
    }

    throw new MockFetchError(method, path, query, body, diffs, allMocks, closestDescription)
  }

  function registerHandler(
    method: string | null,
    url: string | ((url: string) => boolean),
    options: MockMatchOptions | undefined,
    scopeOrigin: string,
  ): MockHandler {
    let origin: string = scopeOrigin
    let urlPatternPath: string | ((url: string) => boolean)
    let patternQuery: Record<string, string> = {}

    if (typeof url === 'string') {
      const parsed = parseUrl(url)
      // If the URL string itself has an origin, use it (overrides scope origin)
      if (parsed.origin !== '') {
        origin = parsed.origin
      }
      urlPatternPath = parsed.path
      patternQuery = parsed.query
    } else {
      urlPatternPath = url
    }

    if (Object.keys(patternQuery).length > 0 && isAsymmetricMatcher(options?.query)) {
      throw new Error(
        `Cannot combine a query string in the URL pattern ('${typeof url === 'string' ? url : ''}') with an asymmetric \`query\` matcher. Use one form or the other.`,
      )
    }

    const handler: InternalHandler = {
      method,
      origin,
      urlPatternPath,
      patternQuery,
      matchOptions: options ?? {},
      responses: [],
    }

    handlers.push(handler)

    const mockHandler: MockHandler = {
      respond(def: MockResponseDef): MockHandler {
        handler.responses.push({kind: 'response', def, persistent: false, consumed: false})
        return mockHandler
      },
      respondPersist(def: MockResponseDef): MockHandler {
        handler.responses.push({kind: 'response', def, persistent: true, consumed: false})
        return mockHandler
      },
      respondWithError(error: Error | (() => Error)): MockHandler {
        handler.responses.push({kind: 'error', error, persistent: false, consumed: false})
        return mockHandler
      },
      respondWithErrorPersist(error: Error | (() => Error)): MockHandler {
        handler.responses.push({kind: 'error', error, persistent: true, consumed: false})
        return mockHandler
      },
    }

    return mockHandler
  }

  function on(
    method: string,
    url: string | ((url: string) => boolean),
    options?: MockMatchOptions,
  ): MockHandler {
    return registerHandler(method, url, options, '')
  }

  function onAny(
    url: string | ((url: string) => boolean),
    options?: MockMatchOptions,
  ): MockHandler {
    return registerHandler(null, url, options, '')
  }

  function getRequests(): ReadonlyArray<RecordedRequest> {
    return [...recordedRequests]
  }

  function assertAllConsumed(): void {
    checkUnconsumedHandlers(handlers)
  }

  function clear(): void {
    handlers.length = 0
    recordedRequests.length = 0
  }

  function scope(baseUrl: string): MockScope {
    const parsed = parseUrl(baseUrl)
    const scopeOrigin = parsed.origin
    if (scopeOrigin === '') {
      throw new Error(`scope() requires a full URL with origin, got: ${baseUrl}`)
    }

    return {
      on(
        method: string,
        url: string | ((url: string) => boolean),
        options?: MockMatchOptions,
      ): MockHandler {
        return registerHandler(method, url, options, scopeOrigin)
      },
      onAny(url: string | ((url: string) => boolean), options?: MockMatchOptions): MockHandler {
        return registerHandler(null, url, options, scopeOrigin)
      },
      getRequests(): ReadonlyArray<RecordedRequest> {
        return recordedRequests.filter((req) => {
          const reqParsed = parseUrl(req.fullUrl)
          return reqParsed.origin === scopeOrigin
        })
      },
      assertAllConsumed(): void {
        const scopedHandlers = handlers.filter((h) => h.origin === scopeOrigin)
        checkUnconsumedHandlers(scopedHandlers)
      },
    }
  }

  return {
    fetch: fetchFn,
    on,
    onAny,
    getRequests,
    assertAllConsumed,
    clear,
    scope,
  }
}

/**
 * Check a set of handlers for unconsumed responses and throw if any are found.
 * @internal
 */
function checkUnconsumedHandlers(handlersToCheck: ReadonlyArray<InternalHandler>): void {
  const unconsumed: string[] = []
  for (const handler of handlersToCheck) {
    const remaining = responsesRemaining(handler)
    if (remaining > 0 && remaining !== Infinity) {
      unconsumed.push(`${describeHandler(handler)} (${remaining} unconsumed)`)
    }
  }
  if (unconsumed.length > 0) {
    throw new Error(`Mock has unconsumed responses:\n  ${unconsumed.join('\n  ')}`)
  }
}

/**
 * Find the first available (unconsumed or persistent) response entry.
 * @internal
 */
function findAvailableResponse(handler: InternalHandler): ResponseEntry | undefined {
  for (const entry of handler.responses) {
    if (entry.persistent) return entry
    if (!entry.consumed) return entry
  }
  return undefined
}
