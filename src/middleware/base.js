const leadingSlash = /^\//
const trailingSlash = /\/$/

module.exports = baseUrl => {
  const baseUri = baseUrl.replace(trailingSlash, '')
  return {
    processOptions: options => {
      if (/^https?:\/\//i.test(options.url)) {
        return options // Already prefixed
      }

      const url = [baseUri, options.url.replace(leadingSlash, '')].join('/')
      return Object.assign({}, options, {url})
    }
  }
}
