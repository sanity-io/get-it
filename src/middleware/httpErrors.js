import createErrorClass from 'create-error-class'

const HttpError = createErrorClass('HttpError', function (res) {
  this.message = `${res.method}-request to ${res.url} resulted in HTTP ${res.statusCode} ${res.statusMessage}`.trim()
  this.response = res
})

module.exports = {
  onResponse: res => {
    const isHttpError = res.statusCode >= 400
    if (!isHttpError) {
      return res
    }

    throw new HttpError(res)
  }
}
