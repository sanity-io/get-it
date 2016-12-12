const objectAssign = require('object-assign')
const urlParse = require('url-parse')

const defaultOptions = {timeout: 120000}

module.exports = opts => {
  const options = typeof opts === 'string'
    ? objectAssign({url: opts}, defaultOptions)
    : objectAssign({}, defaultOptions, opts)

  // Parse URL into parts
  const url = urlParse(
    options.url,
    {},  // Don't use current browser location
    true // Parse query strings
  )

  // Normalize timeouts
  options.timeout = normalizeTimeout(options.timeout)

  // Shallow-merge (override) existing query params
  if (options.query) {
    url.query = objectAssign({}, url.query, removeUndefined(options.query))
  }

  // Implicit POST if we have not specified a method but have a body
  options.method = (options.body && !options.method)
    ? 'POST'
    : (options.method || 'GET').toUpperCase()

  // Stringify URL
  options.url = url.toString()

  return options
}

function normalizeTimeout(time) {
  if (time === false || time === 0) {
    return false
  }

  if (time.connect || time.socket) {
    return time
  }

  const delay = Number(time)
  if (isNaN(delay)) {
    return normalizeTimeout(defaultOptions.timeout)
  }

  return {connect: delay, socket: delay}
}

function removeUndefined(obj) {
  const target = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      target[key] = obj[key]
    }
  }
  return target
}
