module.exports = opts => ({
  onResponse: response => {
    const contentType = response.headers['content-type'] || ''
    const shouldDecode = (opts && opts.force) || contentType.indexOf('application/json') !== -1
    if (!response.body || !contentType || !shouldDecode) {
      return response
    }

    return Object.assign({}, response, {body: tryParse(response.body)})
  },

  processOptions: options =>
    Object.assign({}, options, {
      headers: Object.assign({Accept: 'application/json'}, options.headers)
    })
})

function tryParse(body) {
  try {
    return JSON.parse(body)
  } catch (err) {
    err.message = `Failed to parsed response body as JSON: ${err.message}`
    throw err
  }
}
