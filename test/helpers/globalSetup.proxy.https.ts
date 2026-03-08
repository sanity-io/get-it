import {createProxyServer} from './proxy'

export async function setup() {
  const server = await createProxyServer('https')

  return () => {
    server.closeAllConnections()
    return new Promise((resolve) => server.close(resolve))
  }
}
