const allowed = require('is-retry-allowed')

module.exports = err => {
  // Don't allow retries if we get any http status code by default
  if (err.response && err.response.statusCode) {
    return false
  }

  return allowed(err)
}
