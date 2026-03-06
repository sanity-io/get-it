import {createServer} from './server'

export async function setup() {
  const server = await createServer('http')

  return () => new Promise((resolve) => server.close(resolve))
}
