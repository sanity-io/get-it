import type {BufferedResponse, FetchHeaders, RequestOptions, WrappingMiddleware} from '../types'

type LogFunction = (message: string, ...args: unknown[]) => void

const DEFAULT_REDACT_HEADERS = ['cookie', 'authorization']

interface DebugOptions {
  log?: LogFunction
  redactHeaders?: string[]
  verbose?: boolean
}

let requestId = 0

/**
 * Creates a `WrappingMiddleware` that logs request, response, and error details.
 *
 * Does nothing if no `log` function is provided.
 *
 * By default, redacts `cookie` and `authorization` headers. Pass
 * `redactHeaders: []` to disable redaction, or provide your own list.
 *
 * @param opts - Debug options: `log` is the log function (e.g. `console.log`),
 *   `redactHeaders` lists header names to replace with `"REDACTED"` (defaults
 *   to `['cookie', 'authorization']`), and `verbose` (default `false`) enables
 *   header and body logging.
 * @returns A wrapping middleware that logs before/after each request and on errors.
 *
 * @example
 * ```ts
 * const request = createRequester({
 *   middleware: [debug({log: console.log, redactHeaders: ['authorization']})],
 * })
 * ```
 *
 * @public
 */
export function debug(opts?: DebugOptions): WrappingMiddleware {
  const log = opts?.log
  const redactSet = new Set(
    (opts?.redactHeaders ?? DEFAULT_REDACT_HEADERS).map((h) => h.toLowerCase()),
  )
  const verbose = opts?.verbose ?? false

  if (!log) return noopMiddleware

  return async function debugMiddleware(
    options: RequestOptions,
    next: (reqOpts: RequestOptions) => Promise<BufferedResponse>,
  ): Promise<BufferedResponse> {
    const id = ++requestId
    const method = (options.method ?? 'GET').toUpperCase()
    log('[%s] %s %s', id, method, options.url)

    if (verbose && options.headers) {
      log('[%s] request headers %o', id, headersToObject(options.headers, redactSet))
    }

    if (verbose && options.body !== undefined && options.body !== null) {
      log('[%s] request body %s', id, summarizeBody(options.body))
    }

    try {
      const response = await next(options)

      log('[%s] %d %s', id, response.status, response.statusText)

      if (verbose) {
        log('[%s] response headers %o', id, headersToObject(response.headers, redactSet))
        log('[%s] response body %s', id, summarizeBody(response.text()))
      }

      return response
    } catch (error: unknown) {
      log('[%s] error %s', id, error instanceof Error ? error.message : String(error))
      throw error
    }
  }
}

async function noopMiddleware(
  options: RequestOptions,
  next: (reqOpts: RequestOptions) => Promise<BufferedResponse>,
): Promise<BufferedResponse> {
  return next(options)
}

/**
 * Summarize a body value for logging. Truncates long strings to avoid
 * flooding logs with large payloads.
 */
function summarizeBody(body: unknown): string {
  if (typeof body === 'string') {
    return truncate(body, 16384)
  }

  if (isPlainObject(body) || Array.isArray(body)) {
    return truncate(JSON.stringify(body), 16384)
  }

  if (body instanceof ReadableStream) {
    return '[ReadableStream]'
  }

  if (body instanceof FormData) {
    return '[FormData]'
  }

  if (body instanceof URLSearchParams) {
    return truncate(body.toString(), 16384)
  }

  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    const byteLength = body instanceof ArrayBuffer ? body.byteLength : body.byteLength
    return `[binary ${byteLength} bytes]`
  }

  return String(body)
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + `… (${str.length - max} more characters)`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

function headersToObject(headers: FetchHeaders, redactSet: Set<string>): Record<string, string> {
  const result: Record<string, string> = {}
  new Headers(headers).forEach((value, key) => {
    result[key] = redactSet.has(key.toLowerCase()) ? 'REDACTED' : value
  })
  return result
}
