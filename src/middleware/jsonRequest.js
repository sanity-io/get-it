const objectAssign = require('object-assign')
const isPlainObject = require('is-plain-object')

const serializeTypes = ['boolean', 'string', 'number']
const isBuffer = obj => (
  !!obj.constructor
  && typeof obj.constructor.isBuffer === 'function'
  && obj.constructor.isBuffer(obj)
)

module.exports = () => ({
  processOptions: options => {
    const body = options.body
    const shouldSerialize = body && !isBuffer(body) && (
      serializeTypes.indexOf(typeof body) !== -1
      || Array.isArray(body)
      || isPlainObject(body)
      || (body && typeof body.toJSON === 'function')
    )

    if (!shouldSerialize) {
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
