const objectAssign = require('object-assign')
const urlParse = require('url-parse')

export const parseOptions = opts => {
  const options = objectAssign({}, opts)

  // Parse URL into parts
  const url = urlParse(options.url, true)

  // Shallow-merge (override) existing query params
  if (options.query) {
    url.query = objectAssign({}, url.query, options.query)
  }

  // Implicit POST if we have not specified a method but have a body
  if (options.body && !options.method) {
    options.method = 'POST'
  } else if (options.method) {
    options.method = options.method.toUpperCase()
  }

  // Stringify URL
  options.url = url.toString()

  return options
}
