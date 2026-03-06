import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'

import {createRequest} from 'get-it'
import {nodeFetch} from 'get-it/node'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'

const certsDir = path.join(__dirname, 'certs', 'mtls')
const invalidCertsDir = path.join(__dirname, 'certs', 'invalid-mtls')

const serverOpts: https.ServerOptions = {
  key: fs.readFileSync(path.join(certsDir, 'server.key')),
  cert: fs.readFileSync(path.join(certsDir, 'server.pem')),
  ca: fs.readFileSync(path.join(certsDir, 'ca.pem')),
  requestCert: true,
  rejectUnauthorized: true,
}

const mtlsPort = 9444

describe('mTLS via nodeFetch tls option', () => {
  let server: https.Server

  beforeAll(async () => {
    server = https.createServer(serverOpts, (_req, res) => {
      res.writeHead(200, {'Content-Type': 'text/plain'})
      res.end('mTLS OK')
    })
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject)
      server.listen(mtlsPort, resolve)
    })
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  it('connects with valid client certificate', async () => {
    const request = createRequest({
      fetch: nodeFetch({
        proxy: false,
        tls: {
          cert: fs.readFileSync(path.join(certsDir, 'client.pem')),
          key: fs.readFileSync(path.join(certsDir, 'client.key')),
          ca: fs.readFileSync(path.join(certsDir, 'ca.pem')),
        },
      }),
    })
    const res = await request(`https://localhost:${mtlsPort}/`)
    expect(res.text()).toBe('mTLS OK')
  })

  it('rejects connection without client certificate', async () => {
    const request = createRequest({
      fetch: nodeFetch({
        proxy: false,
        tls: {
          ca: fs.readFileSync(path.join(certsDir, 'ca.pem')),
        },
      }),
    })
    await expect(request(`https://localhost:${mtlsPort}/`)).rejects.toThrow()
  })

  it('rejects connection with invalid client certificate', async () => {
    const request = createRequest({
      fetch: nodeFetch({
        proxy: false,
        tls: {
          cert: fs.readFileSync(path.join(invalidCertsDir, 'client.pem')),
          key: fs.readFileSync(path.join(invalidCertsDir, 'client.key')),
          ca: fs.readFileSync(path.join(certsDir, 'ca.pem')),
        },
      }),
    })
    await expect(request(`https://localhost:${mtlsPort}/`)).rejects.toThrow()
  })
})
