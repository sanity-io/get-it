import type {Middleware} from 'get-it'

import {isBrowserOptions} from '../util/isBrowserOptions'

/** @public */
export function mtls(config: any = {}) {
  if (!config.ca) {
    throw new Error('Required mtls option "ca" is missing')
  }
  if (!config.cert) {
    throw new Error('Required mtls option "cert" is missing')
  }
  if (!config.key) {
    throw new Error('Required mtls option "key" is missing')
  }

  return {
    finalizeOptions: (options) => {
      if (isBrowserOptions(options)) {
        return options
      }

      return {...options, cert: config.cert, key: config.key, ca: config.ca}
    },
  } satisfies Middleware
}
