import fs from 'fs'
import path from 'path'
import {describe, expect, it} from 'vitest'

import {getIt} from '../src/index'
import {base, mtls} from '../src/middleware'
import {expectRequestBody, isNode} from './helpers'
import getMtls from './helpers/mtls'

const port = 4444
const baseUrl = `https://localhost:${port}/req-test`
const describeOrSkip = process.env.SKIP_MTLS_TEST === 'true' ? describe.skip : describe

describeOrSkip('mtls middleware', () => {
  it.runIf(isNode)('should throw on missing options', () => {
    expect(() => getIt([base(baseUrl), mtls()])).to.throw(/Required mtls option "ca" is missing/)
  })

  it.runIf(isNode)('should handle mtls', async () => {
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

  it.runIf(isNode)('should fail on invalid mtls cert', async () => {
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
