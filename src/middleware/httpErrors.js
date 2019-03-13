const createErrorClass = require('create-error-class')

const HttpError = createErrorClass('HttpError', function(res, ctx) {
  let msg = `${res.method}-request to ${res.url} resulted in`
  msg += `HTTP ${res.statusCode} ${res.statusMessage}`

  this.message = msg.trim()
  this.response = res
  this.request = ctx.options
})

module.exports = () => ({
  onResponse: (res, ctx) => {
    const isHttpError = res.statusCode >= 400
    if (!isHttpError) {
      return res
    }

    throw new HttpError(res, ctx)
  }
})
