import {Agent as HttpAgent, type AgentOptions} from 'http'
import {Agent as HttpsAgent} from 'https'

const isHttpsProto = /^https:/i

/**
 * Constructs a http.Agent and uses it for all requests.
 * This can be used to override settings such as `maxSockets`, `maxTotalSockets` (to limit concurrency) or change the `timeout`.
 * @public
 */
export function agent(opts?: AgentOptions): any {
  const httpAgent = new HttpAgent(opts)
  const httpsAgent = new HttpsAgent(opts)
  const agents = {http: httpAgent, https: httpsAgent}

  return {
    finalizeOptions: (options: any) => {
      if (options.agent) {
        return options
      }

      // When maxRedirects>0 we're using the follow-redirects package and this supports the `agents` option.
      if (options.maxRedirects > 0) {
        return {...options, agents}
      }

      // ... otherwise we'll have to detect which agent to use:
      const isHttps = isHttpsProto.test(options.href || options.protocol)
      return {...options, agent: isHttps ? httpsAgent : httpAgent}
    },
  }
}
