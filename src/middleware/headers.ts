import type {Middleware} from '../types'

/** @public */
export function headers(_headers: any, opts: any = {}): any {
  return {
    processOptions: (options: any) => {
      const existing = options.headers || {}
      options.headers = opts.override
        ? Object.assign({}, existing, _headers)
        : Object.assign({}, _headers, existing)

      return options
    },
  } satisfies Middleware
}
