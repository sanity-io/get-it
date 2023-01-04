import createErrorClass from 'create-error-class'

const HttpError = createErrorClass('HttpError', function (res, ctx) {
  const truncatedUrl = res.url.length > 400 ? `${res.url.slice(0, 399)}…` : res.url
  let msg = `${res.method}-request to ${truncatedUrl} resulted in `
  msg += `HTTP ${res.statusCode} ${res.statusMessage}`

  this.message = msg.trim()
  this.response = res
  this.request = ctx.options
})

/** @public */
export function httpErrors() {
  return {
    onResponse: (res: any, ctx: any) => {
      const isHttpError = res.statusCode >= 400
      if (!isHttpError) {
        return res
      }

      throw new HttpError(res, ctx)
    },
  }
}
