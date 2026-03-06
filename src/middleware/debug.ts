import type {TransformMiddleware} from '../types'

type LogFunction = (message: string, ...args: unknown[]) => void

interface DebugOptions {
  log?: LogFunction
  redactHeaders?: string[]
  verbose?: boolean
}

function redactHeaderValues(
  headers: Record<string, string>,
  redactSet: Set<string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key] = redactSet.has(key.toLowerCase()) ? 'REDACTED' : value
  }
  return result
}

function headersToObject(headers: Headers, redactSet: Set<string>): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = redactSet.has(key.toLowerCase()) ? 'REDACTED' : value
  })
  return result
}

export function debug(opts?: DebugOptions): TransformMiddleware {
  const log = opts?.log
  const redactSet = new Set((opts?.redactHeaders ?? []).map((h) => h.toLowerCase()))
  const verbose = opts?.verbose ?? false

  if (!log) return {}

  return {
    beforeRequest(options) {
      const method = (options.method ?? 'GET').toUpperCase()
      log('[request] %s %s', method, options.url)

      if (verbose && options.headers) {
        const redacted =
          redactSet.size > 0 ? redactHeaderValues(options.headers, redactSet) : options.headers
        log('[request] headers %o', redacted)
      }

      return options
    },

    afterResponse(response) {
      log('[response] %d %s', response.status, response.statusText)

      if (verbose) {
        const headerObj = headersToObject(response.headers, redactSet)
        log('[response] headers %o', headerObj)
      }

      return response
    },
  }
}
