import {createServer} from './server'

export async function setup() {
  const server = await createServer('https')

  return () => new Promise((resolve) => server.close(resolve))
}
