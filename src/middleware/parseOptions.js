const queryString = require('query-string')
const objectAssign = require('object-assign')
const parseUrl = require('../util/parseUrl-node')

export const parseOptions = opts => {
  const options = objectAssign({}, opts)

  if (options.query) {
    const qs = queryString.stringify(options.query)
    const path = parseUrl(options.url).pathname
    options.path = `${path.split('?')[0]}?${opts.query}`
  }

  if (options.body && !options.method) {
    options.method = 'POST'
  }

  return options
}
