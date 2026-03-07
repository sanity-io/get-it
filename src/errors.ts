import type {BufferedResponse, JsonResponse, TextResponse} from './types'

/**
 * An error thrown when an HTTP request fails with a non-2xx status code.
 * Contains details about the request and response for debugging purposes.
 *
 * @public
 */
export class HttpError extends Error {
  declare url: string
  declare method: string
  declare status: number
  declare statusText: string
  declare headers: Headers
  declare body: unknown
  declare response: BufferedResponse | JsonResponse | TextResponse

  constructor(opts: {
    url: string
    method: string
    status: number
    statusText: string
    headers: Headers
    body: unknown
    response: BufferedResponse | JsonResponse | TextResponse
  }) {
    super(
      `${opts.method}-request to ${opts.url} resulted in HTTP ${opts.status} ${opts.statusText}`,
    )
    this.name = 'HttpError'
    this.url = opts.url
    this.method = opts.method
    this.status = opts.status
    this.statusText = opts.statusText
    this.headers = opts.headers
    this.body = opts.body
    this.response = opts.response
  }
}
