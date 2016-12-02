const objectAssign = require('object-assign')
const urlParse = require('url-parse')

export const processOptions = opts => {
  const options = objectAssign({}, opts)

  // Parse URL into parts
  const url = urlParse(
    options.url,
    {},  // Don't use current browser location
    true // Parse query strings
  )

  // Shallow-merge (override) existing query params
  if (options.query) {
    url.query = objectAssign({}, url.query, options.query)
  }

  // Implicit POST if we have not specified a method but have a body
  options.method = (options.body && !options.method)
    ? 'POST'
    : (options.method || 'GET').toUpperCase()

  // Stringify URL
  options.url = url.toString()

  return options
}
