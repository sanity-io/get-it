/* eslint-disable no-sync */
const fs = require('fs')
const path = require('path')

const {mtls} = require('../src/middleware')
const requester = require('../src/index')
const {expect, testNode, expectRequestBody, baseUrlHttps} = require('./helpers')
const getMtls = require('./helpers/mtls')

describe('mtls middleware', () => {
  testNode('should throw on missing options', () => {
    expect(() => requester([baseUrlHttps, mtls()])).to.throw(/Required mtls option "ca" is missing/)
  })

  testNode('should handle mtls', () => {
    const body = 'hello from mtls'
    const mtlsOpts = {
      ca: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'ca-crt.pem')),
      key: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'client-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'client-crt.pem'))
    }
    const request = requester([baseUrlHttps, mtls(mtlsOpts)])
    return getMtls().then(async server => {
      await expectRequestBody(request({url: '/plain-text'})).to.eventually.eql(body)
      return server.close()
    })
  })

  testNode('should fail on invalid mtls cert', async () => {
    const request = requester([
      baseUrlHttps,
      mtls({
        ca: fs.readFileSync(path.join(__dirname, 'certs', 'mtls', 'ca-crt.pem')).toString(),
        key: fs.readFileSync(path.join(__dirname, 'certs', 'client', 'client_key.pem')).toString(),
        cert: fs.readFileSync(path.join(__dirname, 'certs', 'client', 'client_cert.crt')).toString()
      })
    ])

    const server = await getMtls()
    await expect(() => request({url: '/plain-text'})).to.throw()

    return server.close()
  })
})
