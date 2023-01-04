import debugIt from 'debug'

const SENSITIVE_HEADERS = ['cookie', 'authorization']

const hasOwn = Object.prototype.hasOwnProperty
const redactKeys = (source: any, redacted: any) => {
  const target: any = {}
  for (const key in source) {
    if (hasOwn.call(source, key)) {
      target[key] = redacted.indexOf(key.toLowerCase()) > -1 ? '<redacted>' : source[key]
    }
  }
  return target
}

/** @public */
export function debug(opts: any = {}): any {
  const verbose = opts.verbose
  const namespace = opts.namespace || 'get-it'
  const defaultLogger = debugIt(namespace)
  const log = opts.log || defaultLogger
  const shortCircuit = log === defaultLogger && !debugIt.enabled(namespace)
  let requestId = 0

  return {
    processOptions: (options: any) => {
      options.debug = log
      options.requestId = options.requestId || ++requestId
      return options
    },

    onRequest: (event: any) => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (shortCircuit || !event) {
        return event
      }

      const options = event.options

      log('[%s] HTTP %s %s', options.requestId, options.method, options.url)

      if (verbose && options.body && typeof options.body === 'string') {
        log('[%s] Request body: %s', options.requestId, options.body)
      }

      if (verbose && options.headers) {
        const headers =
          opts.redactSensitiveHeaders === false
            ? options.headers
            : redactKeys(options.headers, SENSITIVE_HEADERS)

        log('[%s] Request headers: %s', options.requestId, JSON.stringify(headers, null, 2))
      }

      return event
    },

    onResponse: (res: any, context: any) => {
      // Short-circuit if not enabled, to save some CPU cycles with formatting stuff
      if (shortCircuit || !res) {
        return res
      }

      const reqId = context.options.requestId

      log('[%s] Response code: %s %s', reqId, res.statusCode, res.statusMessage)

      if (verbose && res.body) {
        log('[%s] Response body: %s', reqId, stringifyBody(res))
      }

      return res
    },

    onError: (err: any, context: any) => {
      const reqId = context.options.requestId
      if (!err) {
        log('[%s] Error encountered, but handled by an earlier middleware', reqId)
        return err
      }

      log('[%s] ERROR: %s', reqId, err.message)
      return err
    },
  }
}

function stringifyBody(res: any) {
  const contentType = (res.headers['content-type'] || '').toLowerCase()
  const isJson = contentType.indexOf('application/json') !== -1
  return isJson ? tryFormat(res.body) : res.body
}

// Attempt pretty-formatting JSON
function tryFormat(body: any) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body
    return JSON.stringify(parsed, null, 2)
  } catch (err) {
    return body
  }
}
