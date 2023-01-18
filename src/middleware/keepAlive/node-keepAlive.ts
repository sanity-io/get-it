import http from 'http'
import https from 'https'
import type {MiddlewareHooks} from '../../types'

const isHttpsProto = /^https:/i

/** @public */
export const keepAlive = (config: any = {}) => {
  const ms = config.ms || 1000
  const maxFree = config.maxFree || 256
  const agentOptions = {keepAlive: true, keepAliveMsecs: ms, maxFreeSockets: maxFree}
  const httpAgent = new http.Agent(agentOptions)
  const httpsAgent = new https.Agent(agentOptions)
  const agents = {http: httpAgent, https: httpsAgent}

  return {
    finalizeOptions: (options: any) => {
      if (options.agent) {
        return options
      }

      const isHttps = isHttpsProto.test(options.href || options.protocol)
      const keepOpts =
        options.maxRedirects === 0 ? {agent: isHttps ? httpsAgent : httpAgent} : {agents}

      return Object.assign({}, options, keepOpts)
    },
  } satisfies MiddlewareHooks
}
