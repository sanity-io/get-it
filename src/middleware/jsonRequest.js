const objectAssign = require('object-assign')

module.exports = () => ({
  processOptions: options => {
    if (typeof options.body === 'undefined') {
      return options
    }

    return objectAssign({}, options, {
      body: JSON.stringify(options.body),
      headers: objectAssign({}, options.headers, {
        'Content-Type': 'application/json'
      })
    })
  }
})
