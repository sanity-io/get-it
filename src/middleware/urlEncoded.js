import {isPlainObject} from 'is-plain-object'
import urlEncode from 'form-urlencoded'

const encode = urlEncode.default || urlEncode

const isBuffer = obj =>
  !!obj.constructor &&
  typeof obj.constructor.isBuffer === 'function' &&
  obj.constructor.isBuffer(obj)

export default () => ({
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
