import type {TransformMiddleware} from '../types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

export function urlEncoded(): TransformMiddleware {
  return {
    beforeRequest(options) {
      if (options.body === undefined || options.body === null) return options
      if (!isPlainObject(options.body)) return options

      // Don't override existing content-type
      if (options.headers) {
        const hasContentType = Object.keys(options.headers).some(
          (k) => k.toLowerCase() === 'content-type',
        )
        if (hasContentType) return options
      }

      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(options.body)) {
        if (value !== undefined) {
          params.set(key, String(value))
        }
      }

      return {
        ...options,
        body: params.toString(),
        headers: {
          ...options.headers,
          'content-type': 'application/x-www-form-urlencoded',
        },
      }
    },
  }
}
