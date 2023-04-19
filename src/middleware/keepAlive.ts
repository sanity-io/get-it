export function buildKeepAlive(agent: any) {
  return function keepAlive(config: any = {}): any {
    const ms = config.ms || 1000
    const maxFree = config.maxFree || 256
    const agentOptions = {
      keepAlive: true,
      keepAliveMsecs: ms,
      maxFreeSockets: maxFree,
    }

    return agent(agentOptions)
  }
}
