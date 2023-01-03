import encode from 'form-urlencoded'
import {isPlainObject} from 'is-plain-object'

const isBuffer = (obj: any) =>
  !!obj.constructor &&
  typeof obj.constructor.isBuffer === 'function' &&
  obj.constructor.isBuffer(obj)

/** @public */
export function urlEncoded(): any {
  return {
    processOptions: (options: any) => {
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
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      })
    },
  }
}
