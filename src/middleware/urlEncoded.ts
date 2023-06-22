import {isPlainObject} from 'is-plain-object'

import type {Middleware} from '../types'
import {isBuffer} from '../util/isBuffer'

function encode(data: Record<string, string | Set<number | string>>): string {
  const query = new URLSearchParams()

  const nest = (name: string, _value: unknown) => {
    const value = _value instanceof Set ? Array.from(_value) : _value
    if (Array.isArray(value)) {
      if (value.length) {
        for (const index in value) {
          nest(`${name}[${index}]`, value[index])
        }
      } else {
        query.append(`${name}[]`, '')
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, obj] of Object.entries(value)) {
        nest(`${name}[${key}]`, obj)
      }
    } else {
      query.append(name, value as string)
    }
  }

  for (const [key, value] of Object.entries(data)) {
    nest(key, value)
  }

  return query.toString()
}

/** @public */
export function urlEncoded() {
  return {
    processOptions: (options) => {
      const body = options.body
      if (!body) {
        return options
      }

      const isStream = typeof body.pipe === 'function'
      const shouldSerialize = !isStream && !isBuffer(body) && isPlainObject(body)

      if (!shouldSerialize) {
        return options
      }

      return {
        ...options,
        body: encode(options.body),
        headers: {
          ...options.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    },
  } satisfies Middleware
}
