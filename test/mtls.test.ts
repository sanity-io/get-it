import fs from 'node:fs'
import path from 'node:path'

import {environment, getIt} from 'get-it'
import {base, mtls} from 'get-it/middleware'
import {describe, expect, it} from 'vitest'

import {expectRequestBody} from './helpers'
import getMtls from './helpers/mtls'

const port = 4444
const baseUrl = `https://localhost:${port}/req-test`

describe.runIf(environment === 'node')('mtls middleware', () => {
  it('should throw on missing options', () => {
    expect(() => getIt([base(baseUrl), mtls()])).to.throw(/Required mtls option "ca" is missing/)
  })

  it('should handle mtls', async () => {
    const body = 'hello from mtls'
    const mtlsOpts = {
      ca: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'ca.pem')),
      key: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'client.key')),
      cert: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'client.pem')),
    }
    const request = getIt([base(baseUrl), mtls(mtlsOpts)])
    await getMtls(port).then(async (server: any) => {
      await expectRequestBody(request({url: '/plain-text'})).resolves.toEqual(body)
      return server.close()
    })
  })

  it('should fail on invalid mtls cert', async () => {
    const request = getIt([
      base(baseUrl),
      mtls({
        ca: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'ca.pem')).toString(),
        key: fs
          .readFileSync(path.join(__dirname, 'certs', 'invalid-mtls', 'client.key'))
          .toString(),
        cert: fs
          .readFileSync(path.join(__dirname, 'certs', 'invalid-mtls', 'client.pem'))
          .toString(),
      }),
    ])

    const server: any = await getMtls(port)
    await expect(() => request({url: '/plain-text'})).to.throw()

    return server.close()
  })
})
