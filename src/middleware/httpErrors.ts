import type {Middleware} from 'get-it'

class HttpError extends Error {
  response: any
  request: any
  constructor(res: any, ctx: any) {
    super()
    const truncatedUrl = res.url.length > 400 ? `${res.url.slice(0, 399)}…` : res.url
    let msg = `${res.method}-request to ${truncatedUrl} resulted in `
    msg += `HTTP ${res.statusCode} ${res.statusMessage}`

    this.message = msg.trim()
    this.response = res
    this.request = ctx.options
  }
}

/** @public */
export function httpErrors() {
  return {
    onResponse: (res, ctx) => {
      const isHttpError = res.statusCode >= 400
      if (!isHttpError) {
        return res
      }

      throw new HttpError(res, ctx)
    },
  } satisfies Middleware
}
