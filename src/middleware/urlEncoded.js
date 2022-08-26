const isPlainObject = require('is-plain-object')
const urlEncode = require('form-urlencoded')

const encode = urlEncode.default || urlEncode

const isBuffer = obj =>
  !!obj.constructor &&
  typeof obj.constructor.isBuffer === 'function' &&
  obj.constructor.isBuffer(obj)

module.exports = () => ({
  processOptions: options => {
    const body = options.body
    if (!body) {
      return options
    }

    const isStream = typeof body.pipe === 'function'
    const shouldSerialize = !isStream && !isBuffer(body) && isPlainObject(body)

    if (!shouldSerialize) {
      return options
    }

    return Object.assign({}, options, {
      body: encode(options.body),
      headers: Object.assign({}, options.headers, {
        'Content-Type': 'application/x-www-form-urlencoded'
      })
    })
  }
})
