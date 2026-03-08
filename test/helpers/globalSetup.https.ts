import {createServer} from './server'

export async function setup() {
  const server = await createServer('https')

  return () => {
    server.closeAllConnections()
    return new Promise((resolve) => server.close(resolve))
  }
}
