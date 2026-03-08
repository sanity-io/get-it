import type {FetchHeaders, TransformMiddleware} from '../types'

type LogFunction = (message: string, ...args: unknown[]) => void

const DEFAULT_REDACT_HEADERS = ['cookie', 'authorization']

interface DebugOptions {
  log?: LogFunction
  redactHeaders?: string[]
  verbose?: boolean
}

let requestId = 0

/**
 * Creates a `TransformMiddleware` that logs request and response details.
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
 * @returns A transform middleware that logs before/after each request.
 *
 * @example
 * ```ts
 * const request = createRequest({
 *   middleware: [debug({log: console.log, redactHeaders: ['authorization']})],
 * })
 * ```
 *
 * @public
 */
export function debug(opts?: DebugOptions): TransformMiddleware {
  const log = opts?.log
  const redactSet = new Set(
    (opts?.redactHeaders ?? DEFAULT_REDACT_HEADERS).map((h) => h.toLowerCase()),
  )
  const verbose = opts?.verbose ?? false

  if (!log) return {}

  return {
    beforeRequest(options) {
      const id = ++requestId
      const method = (options.method ?? 'GET').toUpperCase()
      log('[%s] %s %s', id, method, options.url)

      if (verbose && options.headers) {
        const redacted = headersToObject(options.headers, redactSet)
        log('[%s] request headers %o', id, redacted)
      }

      if (verbose && options.body !== undefined && options.body !== null) {
        log('[%s] request body %s', id, summarizeBody(options.body))
      }

      return {...options, meta: {...options.meta, debugRequestId: id}}
    },

    afterResponse(response) {
      log('[response] %d %s', response.status, response.statusText)

      if (verbose) {
        const headerObj = headersToObject(response.headers, redactSet)
        log('[response] headers %o', headerObj)
      }

      if (verbose) {
        log('[response] body %s', summarizeBody(response.text()))
      }

      return response
    },
  }
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
