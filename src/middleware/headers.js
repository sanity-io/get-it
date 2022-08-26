module.exports = (headers, opts = {}) => ({
  processOptions: options => {
    const existing = options.headers || {}
    options.headers = opts.override
      ? Object.assign({}, existing, headers)
      : Object.assign({}, headers, existing)

    return options
  }
})
