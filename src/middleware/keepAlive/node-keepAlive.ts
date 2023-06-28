import http from 'http'
import https from 'https'

import type {Middleware} from '../../types'
import {isBrowserOptions} from '../../util/isBrowserOptions'

const isHttpsProto = /^https:/i

/** @public */
export function keepAlive(config: any = {}) {
  const ms = config.ms || 1000
  const maxFree = config.maxFree || 256
  const agentOptions = {keepAlive: true, keepAliveMsecs: ms, maxFreeSockets: maxFree}
  const httpAgent = new http.Agent(agentOptions)
  const httpsAgent = new https.Agent(agentOptions)
  const agents = {http: httpAgent, https: httpsAgent}

  return {
    finalizeOptions: (options) => {
      if (isBrowserOptions(options)) {
        return options
      }

      if (options.agent) {
        return options
      }

      const isHttps = isHttpsProto.test(options.href! || options.protocol!)
      const keepOpts =
        options.maxRedirects === 0 ? {agent: isHttps ? httpsAgent : httpAgent} : {agents}

      return Object.assign({}, options, keepOpts)
    },
  } satisfies Middleware
}
