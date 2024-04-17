import type {Middleware} from 'get-it'

import {isBuffer} from '../util/isBuffer'
import {isPlainObject} from '../util/isPlainObject'

const serializeTypes = ['boolean', 'string', 'number']

/** @public */
export function jsonRequest() {
  return {
    processOptions: (options) => {
      const body = options.body
      if (!body) {
        return options
      }

      const isStream = typeof body.pipe === 'function'
      const shouldSerialize =
        !isStream &&
        !isBuffer(body) &&
        (serializeTypes.indexOf(typeof body) !== -1 || Array.isArray(body) || isPlainObject(body))

      if (!shouldSerialize) {
        return options
      }

      return Object.assign({}, options, {
        body: JSON.stringify(options.body),
        headers: Object.assign({}, options.headers, {
          'Content-Type': 'application/json',
        }),
      })
    },
  } satisfies Middleware
}
