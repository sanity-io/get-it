import type {Middleware} from 'get-it'

/** @public */
export function headers(_headers: any, opts: any = {}) {
  return {
    processOptions: (options) => {
      const existing = options.headers || {}
      options.headers = opts.override
        ? Object.assign({}, existing, _headers)
        : Object.assign({}, _headers, existing)

      return options
    },
  } satisfies Middleware
}
