const objectAssign = require('object-assign')

module.exports = (headers, opts = {}) => ({
  processOptions: options => {
    const existing = options.headers || {}
    options.headers = opts.override
      ? objectAssign({}, existing, headers)
      : objectAssign({}, headers, existing)

    return options
  }
})
