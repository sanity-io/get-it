import type {FetchFunction, FetchResponse} from '../types'
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
  query?: Record<string, string> | AsymmetricMatcher
  body?: unknown
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

interface ResponseEntry {
  def: MockResponseDef
  persistent: boolean
  consumed: boolean
}

interface InternalHandler {
  method: string | null // null = any method
  origin: string // empty string = match any origin; non-empty = must match
  urlPatternPath: string | ((url: string) => boolean) // path portion only (no query)
  patternQuery: Record<string, string> // query parsed from the url pattern
  matchOptions: MockMatchOptions
  responses: ResponseEntry[]
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
 * Build a FetchResponse-compatible object from a MockResponseDef.
 * @internal
 */
function buildFetchResponse(def: MockResponseDef): FetchResponse {
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
        const val = handler.matchOptions.query[key]
        if (typeof val === 'string') {
          mergedQuery[key] = val
        }
      }
    }
    const queryStr = new URLSearchParams(mergedQuery).toString()
    if (queryStr) {
      urlPart += `?${queryStr}`
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
  if (handler.matchOptions.body === undefined || deepMatch(handler.matchOptions.body, body)) {
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
  optionsQuery: Record<string, string> | AsymmetricMatcher | undefined,
): Record<string, string> | AsymmetricMatcher {
  if (isAsymmetricMatcher(optionsQuery)) {
    // If options query is an asymmetric matcher, use it directly
    // But if there are also pattern query params, we need to handle both
    if (Object.keys(patternQuery).length === 0) {
      return optionsQuery
    }
    // Pattern query params exist along with asymmetric matcher — not a common case,
    // but we handle it by returning the asymmetric matcher (it takes precedence)
    return optionsQuery
  }
  const merged: Record<string, string> = {...patternQuery}
  if (isRecord(optionsQuery)) {
    for (const key of Object.keys(optionsQuery)) {
      const val = optionsQuery[key]
      if (typeof val === 'string') {
        merged[key] = val
      }
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
  if (handler.matchOptions.body !== undefined && !deepMatch(handler.matchOptions.body, body)) {
    if (isRecord(handler.matchOptions.body) || Array.isArray(handler.matchOptions.body)) {
      diffs.push(...diffValues('body', handler.matchOptions.body, body))
    } else {
      diffs.push({path: 'body', expected: handler.matchOptions.body, actual: body})
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

    // Parse body if content-type is JSON
    let body: unknown = undefined
    if (init?.body !== undefined && init.body !== null && typeof init.body === 'string') {
      const ct = getContentType(normalizedHeaders)
      if (ct !== null && ct.includes('application/json')) {
        const result = tryParseJson(init.body)
        if (result !== undefined) {
          body = result.parsed
        } else {
          body = init.body
        }
      } else {
        body = init.body
      }
    }

    // Record the request
    recordedRequests.push({
      method,
      url: path,
      fullUrl: input,
      query,
      headers: normalizedHeaders,
      body,
    })

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
      if (handler.matchOptions.body !== undefined && !deepMatch(handler.matchOptions.body, body)) {
        continue
      }

      // Find first unconsumed response
      const responseEntry = findAvailableResponse(handler)
      if (responseEntry === undefined) continue

      // Consume non-persistent responses
      if (!responseEntry.persistent) {
        responseEntry.consumed = true
      }

      return buildFetchResponse(responseEntry.def)
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
      const score = scoreMatch(handler, method, requestOrigin, path, query, body)
      if (score > closestScore) {
        closestScore = score
        closestHandler = handler
      }
    }

    let diffs: Diff[] = []
    let closestDescription: string | undefined
    if (closestHandler !== undefined) {
      closestDescription = describeHandler(closestHandler)
      diffs = buildDiffs(closestHandler, method, requestOrigin, path, query, body)
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
        handler.responses.push({def, persistent: false, consumed: false})
        return mockHandler
      },
      respondPersist(def: MockResponseDef): MockHandler {
        handler.responses.push({def, persistent: true, consumed: false})
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
