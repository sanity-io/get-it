import fs from 'fs'
import path from 'path'
import {describe, expect} from 'vitest'

import {getIt} from '../src/index'
import {base, mtls} from '../src/middleware'
import {expectRequestBody, testNode} from './helpers'
import getMtls from './helpers/mtls'

const port = 4443
const baseUrl = `https://localhost:${port}/req-test`
const describeOrSkip = process.env.SKIP_MTLS_TEST === 'true' ? describe.skip : describe

describeOrSkip('mtls middleware', () => {
  testNode('should throw on missing options', () => {
    expect(() => getIt([base(baseUrl), mtls()])).to.throw(/Required mtls option "ca" is missing/)
  })

  testNode('should handle mtls', async () => {
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

  testNode('should fail on invalid mtls cert', async () => {
    const request = getIt([
      base(baseUrl),
      mtls({
        ca: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'ca.pem')).toString(),
        key: fs.readFileSync(path.join(__dirname, 'certs', 'client', 'client_key.pem')).toString(),
        cert: fs
          .readFileSync(path.join(__dirname, 'certs', 'client', 'client_cert.crt'))
          .toString(),
      }),
    ])

    const server: any = await getMtls(port)
    await expect(() => request({url: '/plain-text'})).to.throw()

    return server.close()
  })
})
