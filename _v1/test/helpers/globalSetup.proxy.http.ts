import {createProxyServer} from './proxy'

export async function setup() {
  const server = await createProxyServer('http')

  return () => new Promise((resolve) => server.close(resolve))
}
