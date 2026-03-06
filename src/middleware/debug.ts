import type {FetchHeaders, TransformMiddleware} from '../types'

type LogFunction = (message: string, ...args: unknown[]) => void

interface DebugOptions {
  log?: LogFunction
  redactHeaders?: string[]
  verbose?: boolean
}

/** @public */
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
        const redacted = headersToObject(options.headers, redactSet)
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

function headersToObject(headers: FetchHeaders, redactSet: Set<string>): Record<string, string> {
  const result: Record<string, string> = {}
  new Headers(headers).forEach((value, key) => {
    result[key] = redactSet.has(key.toLowerCase()) ? 'REDACTED' : value
  })
  return result
}
