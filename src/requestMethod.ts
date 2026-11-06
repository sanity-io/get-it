import type {RequestOptions} from './types'

/**
 * The HTTP method a request is sent with, uppercased. Without a `method`
 * option, a request with a body is sent as `POST`, as in `buildFetchArgs()`.
 *
 * @internal
 */
export function getRequestMethod(options: RequestOptions): string {
  if (options.method) return options.method.toUpperCase()
  return options.body === undefined || options.body === null ? 'GET' : 'POST'
}
